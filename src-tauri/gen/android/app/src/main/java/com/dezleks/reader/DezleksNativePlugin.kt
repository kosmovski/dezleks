package com.dezleks.reader

import android.app.Activity
import android.Manifest
import android.content.Intent
import android.graphics.Color
import android.graphics.Paint
import android.graphics.Typeface
import android.graphics.pdf.PdfDocument
import android.graphics.BitmapFactory
import android.net.Uri
import android.os.Environment
import android.os.CancellationSignal
import android.os.ParcelFileDescriptor
import android.provider.MediaStore
import android.util.Base64
import android.print.PrintAttributes
import android.print.PrintManager
import android.print.PrintDocumentAdapter
import android.print.PrintDocumentInfo
import android.print.pdf.PrintedPdfDocument
import android.speech.tts.TextToSpeech
import android.text.Layout
import android.text.StaticLayout
import android.text.TextPaint
import androidx.activity.result.ActivityResult
import androidx.core.content.FileProvider
import app.tauri.PermissionHelper
import app.tauri.annotation.ActivityCallback
import app.tauri.annotation.Command
import app.tauri.annotation.PermissionCallback
import app.tauri.annotation.TauriPlugin
import app.tauri.plugin.Invoke
import app.tauri.plugin.Plugin
import app.tauri.plugin.JSObject
import com.google.ai.edge.litertlm.Backend
import com.google.ai.edge.litertlm.Content
import com.google.ai.edge.litertlm.Contents
import com.google.ai.edge.litertlm.ConversationConfig
import com.google.ai.edge.litertlm.Engine
import com.google.ai.edge.litertlm.EngineConfig
import com.google.ai.edge.litertlm.LogSeverity
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.text.TextRecognition
import com.google.mlkit.vision.text.latin.TextRecognizerOptions
import com.googlecode.tesseract.android.TessBaseAPI
import java.io.File
import java.io.IOException
import java.net.HttpURLConnection
import java.net.URL
import java.text.SimpleDateFormat
import java.util.Collections
import java.util.Date
import java.util.Locale
import java.util.UUID
import java.util.concurrent.atomic.AtomicBoolean

@TauriPlugin
class DezleksNativePlugin(private val activity: Activity) : Plugin(activity) {
  private var engine: Engine? = null
  private var engineModelPath: String? = null
  private var pendingTakePhotoUri: Uri? = null
  private var tts: TextToSpeech? = null

  private fun escapeHtml(s: String): String {
    val out = StringBuilder(s.length + 16)
    for (ch in s) {
      when (ch) {
        '&' -> out.append("&amp;")
        '<' -> out.append("&lt;")
        '>' -> out.append("&gt;")
        '"' -> out.append("&quot;")
        '\'' -> out.append("&#39;")
        else -> out.append(ch)
      }
    }
    return out.toString()
  }

  @Command
  fun printText(invoke: Invoke) {
    val args = invoke.getArgs()
    val text = args.getString("text") ?: ""
    if (text.isBlank()) {
      invoke.reject("text is required")
      return
    }

    val fontFamily = args.optString("fontFamily", "system")
    val fontSizePx = args.optDouble("fontSizePx", 20.0).toFloat().coerceAtLeast(8f)
    val lineHeightMult = args.optDouble("lineHeight", 1.6).toFloat().coerceAtLeast(1.0f)
    val textColorRaw = args.optString("textColor", "#1a1a1a")

    fun safeParseColor(s: String, fallback: Int): Int {
      return try {
        Color.parseColor(s.trim())
      } catch (_: Throwable) {
        fallback
      }
    }

    val textColor = safeParseColor(textColorRaw, Color.parseColor("#1a1a1a"))

    fun loadTypeface(): Typeface? {
      if (fontFamily == "system") return null
      if (fontFamily.startsWith("OpenDyslexic-")) {
        val fontFile = "fonts/$fontFamily.otf"
        return try {
          Typeface.createFromAsset(activity.assets, fontFile)
        } catch (_: Throwable) {
          null
        }
      }
      return null
    }

    val loadedTypeface = loadTypeface()

    activity.runOnUiThread {
      try {
        val pm = activity.getSystemService(Activity.PRINT_SERVICE) as PrintManager
        val jobName = "Dezleks"

        val adapter = object : PrintDocumentAdapter() {
          private var printAttrs: PrintAttributes? = null

          override fun onLayout(
            oldAttributes: PrintAttributes?,
            newAttributes: PrintAttributes?,
            cancellationSignal: CancellationSignal?,
            callback: LayoutResultCallback?,
            extras: android.os.Bundle?
          ) {
            if (cancellationSignal?.isCanceled == true) {
              callback?.onLayoutCancelled()
              return
            }
            printAttrs = newAttributes
            val info = PrintDocumentInfo.Builder("dezleks-text.pdf")
              .setContentType(PrintDocumentInfo.CONTENT_TYPE_DOCUMENT)
              .build()
            callback?.onLayoutFinished(info, true)
          }

          override fun onWrite(
            pages: Array<out android.print.PageRange>?,
            destination: ParcelFileDescriptor?,
            cancellationSignal: CancellationSignal?,
            callback: WriteResultCallback?
          ) {
            if (destination == null) {
              callback?.onWriteFailed("No destination")
              return
            }
            val attrs = printAttrs ?: PrintAttributes.Builder().build()
            val pdf = PrintedPdfDocument(activity, attrs)
            try {
              val pageWidth = pdf.pageWidth
              val pageHeight = pdf.pageHeight
              val margin = 36f
              val contentWidth = (pageWidth - (margin * 2)).toInt().coerceAtLeast(1)
              val contentHeight = (pageHeight - (margin * 2)).toInt().coerceAtLeast(1)

              val paint = TextPaint(Paint.ANTI_ALIAS_FLAG).apply {
                color = textColor
                textSize = fontSizePx
                if (loadedTypeface != null) typeface = loadedTypeface
              }

              val layout = StaticLayout.Builder
                .obtain(text, 0, text.length, paint, contentWidth)
                .setAlignment(Layout.Alignment.ALIGN_NORMAL)
                .setLineSpacing(0f, lineHeightMult)
                .setIncludePad(false)
                .build()

              val totalHeight = layout.height
              val pageCount = ((totalHeight + contentHeight - 1) / contentHeight).coerceAtLeast(1)

              for (i in 0 until pageCount) {
                if (cancellationSignal?.isCanceled == true) {
                  callback?.onWriteCancelled()
                  return
                }
                val pageInfo = PdfDocument.PageInfo.Builder(pageWidth, pageHeight, i + 1).create()
                val page = pdf.startPage(pageInfo)
                val canvas = page.canvas

                canvas.drawColor(Color.WHITE)

                val yOffset = i * contentHeight
                canvas.save()
                canvas.translate(margin, margin - yOffset.toFloat())
                canvas.clipRect(0f, yOffset.toFloat(), contentWidth.toFloat(), (yOffset + contentHeight).toFloat())
                layout.draw(canvas)
                canvas.restore()

                pdf.finishPage(page)
              }

              android.os.ParcelFileDescriptor.AutoCloseOutputStream(destination).use { out ->
                pdf.writeTo(out)
              }

              callback?.onWriteFinished(arrayOf(android.print.PageRange.ALL_PAGES))
            } catch (e: Exception) {
              callback?.onWriteFailed(e.message ?: "write failed")
            } finally {
              pdf.close()
              try {
                destination.close()
              } catch (_: Throwable) {
              }
            }
          }
        }

        pm.print(jobName, adapter, PrintAttributes.Builder().build())
        val out = JSObject().apply { put("ok", true) }
        invoke.resolve(out)
      } catch (e: Exception) {
        invoke.reject(e.message ?: "printText failed", e, null)
      }
    }
  }

  private fun mapTtsLocale(lang: String): Locale {
    return when (lang.trim().lowercase()) {
      "uk", "ukr" -> Locale("uk", "UA")
      "en", "eng" -> Locale.ENGLISH
      else -> Locale.getDefault()
    }
  }

  private fun ensureTts(onReady: (TextToSpeech) -> Unit, onError: (String) -> Unit) {
    val existing = tts
    if (existing != null) {
      onReady(existing)
      return
    }

    val settled = AtomicBoolean(false)
    var created: TextToSpeech? = null
    created = TextToSpeech(activity) { status ->
      if (settled.getAndSet(true)) return@TextToSpeech
      val readyTts = created
      if (readyTts == null) {
        onError("tts init failed")
        return@TextToSpeech
      }
      if (status == TextToSpeech.SUCCESS) {
        tts = readyTts
        onReady(readyTts)
      } else {
        try {
          readyTts.shutdown()
        } catch (_: Throwable) {
        }
        onError("tts init failed")
      }
    }
  }

  @Command
  fun speakText(invoke: Invoke) {
    val args = invoke.getArgs()
    val text = args.getString("text") ?: ""
    if (text.isBlank()) {
      invoke.reject("text is required")
      return
    }
    val langRaw = args.optString("lang", "uk")
    val locale = mapTtsLocale(langRaw ?: "uk")

    activity.runOnUiThread {
      ensureTts(onReady = { ttsEngine ->
        try {
          val availability = ttsEngine.isLanguageAvailable(locale)
          if (availability == TextToSpeech.LANG_MISSING_DATA || availability == TextToSpeech.LANG_NOT_SUPPORTED) {
            invoke.reject("tts language not supported: ${locale.toLanguageTag()}")
            return@ensureTts
          }

          val setLangResult = ttsEngine.setLanguage(locale)
          if (setLangResult == TextToSpeech.LANG_MISSING_DATA || setLangResult == TextToSpeech.LANG_NOT_SUPPORTED) {
            invoke.reject("tts language set failed: ${locale.toLanguageTag()}")
            return@ensureTts
          }

          val utteranceId = "dezleks-${UUID.randomUUID()}"
          val speakResult = ttsEngine.speak(text, TextToSpeech.QUEUE_FLUSH, null, utteranceId)
          if (speakResult == TextToSpeech.ERROR) {
            invoke.reject("tts speak failed")
            return@ensureTts
          }

          val out = JSObject().apply { put("ok", true) }
          invoke.resolve(out)
        } catch (e: Exception) {
          invoke.reject(e.message ?: "speakText failed", e, null)
        }
      }, onError = { msg ->
        invoke.reject(msg)
      })
    }
  }

  private fun decodeBase64(s: String): ByteArray {
    return Base64.decode(s, Base64.DEFAULT)
  }

  private fun tessDataRootDir(): File {
    return File(activity.filesDir, "tesseract").also { it.mkdirs() }
  }

  private fun looksLikeHtml(bytes: ByteArray): Boolean {
    if (bytes.isEmpty()) return false
    val s = try {
      String(bytes, Charsets.UTF_8).trimStart()
    } catch (_: Throwable) {
      return false
    }
    if (s.isEmpty()) return false
    val low = s.lowercase()
    return low.startsWith("<!doctype html") || low.startsWith("<html") || low.contains("<head") || low.contains("<body")
  }

  private fun isInvalidTraineddata(file: File): Boolean {
    if (!file.exists()) return true
    if (file.length() < 1024) return true
    val head = try {
      file.inputStream().use { it.readNBytes(256) }
    } catch (_: Throwable) {
      return true
    }
    return looksLikeHtml(head)
  }

  private fun downloadTraineddata(lang: String, repo: String, out: File) {
    val tmp = File(out.parentFile, "${out.name}.part")
    if (tmp.exists()) tmp.delete()

    val url = URL("https://raw.githubusercontent.com/tesseract-ocr/$repo/main/$lang.traineddata")
    val conn = (url.openConnection() as HttpURLConnection).apply {
      instanceFollowRedirects = true
      connectTimeout = 15000
      readTimeout = 45000
      setRequestProperty("User-Agent", "Dezleks/1.0")
    }

    conn.inputStream.use { input ->
      tmp.outputStream().use { output ->
        input.copyTo(output)
      }
    }

    if (isInvalidTraineddata(tmp)) {
      tmp.delete()
      throw IOException("downloaded traineddata is invalid for lang=$lang repo=$repo")
    }

    if (out.exists()) out.delete()
    if (!tmp.renameTo(out)) {
      tmp.inputStream().use { input ->
        out.outputStream().use { output ->
          input.copyTo(output)
        }
      }
      tmp.delete()
    }
  }

  private fun ensureTraineddata(lang: String, force: Boolean = false, repo: String = "tessdata_fast"): File {
    val root = tessDataRootDir()
    val tessdata = File(root, "tessdata").also { it.mkdirs() }
    val out = File(tessdata, "$lang.traineddata")
    if (!force && !isInvalidTraineddata(out)) return out
    downloadTraineddata(lang, repo, out)
    return out
  }

  private fun ensureTessdataFor(lang: String) {
    val parts = lang.split("+").map { it.trim() }.filter { it.isNotEmpty() }
    for (p in parts) ensureTraineddata(p)
  }

  @Command
  @Throws(IOException::class)
  private fun createImageFileUri(): Uri {
    val timeStamp = SimpleDateFormat("yyyyMMdd_HHmmss").format(Date())
    val imageFileName = "JPEG_" + timeStamp + "_"
    val storageDir = activity.getExternalFilesDir(Environment.DIRECTORY_PICTURES)
    val photoFile = File.createTempFile(imageFileName, ".jpg", storageDir)
    return FileProvider.getUriForFile(
      activity,
      activity.packageName.toString() + ".fileprovider",
      photoFile
    )
  }

  private fun startTakePhoto(invoke: Invoke) {
    val takePictureIntent = Intent(MediaStore.ACTION_IMAGE_CAPTURE)
    if (takePictureIntent.resolveActivity(activity.packageManager) == null) {
      invoke.reject("camera not available")
      return
    }
    val imageFileUri: Uri = try {
      createImageFileUri()
    } catch (e: Exception) {
      invoke.reject(e.message ?: "failed to create photo file")
      return
    }
    pendingTakePhotoUri = imageFileUri
    takePictureIntent.putExtra(MediaStore.EXTRA_OUTPUT, imageFileUri)
    startActivityForResult(invoke, takePictureIntent, "onTakePhotoResult")
  }

  @Command
  fun takePhoto(invoke: Invoke) {
    val camPermission = arrayOf(Manifest.permission.CAMERA)
    if (!PermissionHelper.hasPermissions(activity, camPermission) &&
      PermissionHelper.hasDefinedPermission(activity, Manifest.permission.CAMERA)
    ) {
      val h = handle
      if (h == null) {
        invoke.reject("plugin handle not initialized")
        return
      }
      h.requestPermissions(invoke, camPermission, "onTakePhotoPermission")
      return
    }
    startTakePhoto(invoke)
  }

  @PermissionCallback
  fun onTakePhotoPermission(invoke: Invoke) {
    startTakePhoto(invoke)
  }

  @ActivityCallback
  fun onTakePhotoResult(invoke: Invoke, result: ActivityResult) {
    val uri = pendingTakePhotoUri
    pendingTakePhotoUri = null
    if (result.resultCode != Activity.RESULT_OK || uri == null) {
      invoke.reject("cancelled")
      return
    }
    val bytes = activity.contentResolver.openInputStream(uri)?.use { it.readBytes() }
    if (bytes == null || bytes.isEmpty()) {
      invoke.reject("failed to read captured photo")
      return
    }
    val out = JSObject().apply {
      put("imageBase64", Base64.encodeToString(bytes, Base64.NO_WRAP))
      put("mime", "image/jpeg")
    }
    invoke.resolve(out)
  }

  @Command
  fun tesseractOcr(invoke: Invoke) {
    val args = invoke.getArgs()
    val langRaw = args.getString("lang") ?: "eng"
    val lang = langRaw
      .split("+")
      .map { it.trim().lowercase() }
      .filter { it.isNotEmpty() }
      .joinToString("+")
    val imageBase64 = args.getString("imageBase64") ?: ""
    if (imageBase64.isBlank()) {
      invoke.reject("imageBase64 is required")
      return
    }
    if (lang.isBlank()) {
      invoke.reject("lang is required")
      return
    }

    Thread {
      try {
        ensureTessdataFor(lang)

        val bytes = decodeBase64(imageBase64)
        val bmp = BitmapFactory.decodeByteArray(bytes, 0, bytes.size)
        if (bmp == null) {
          invoke.reject("failed to decode image")
          return@Thread
        }

        val dataPath = tessDataRootDir().absolutePath + File.separator

        fun tryInitSingle(p: String): Boolean {
          val a = TessBaseAPI()
          val ok = try {
            a.init(dataPath, p, TessBaseAPI.OEM_DEFAULT)
          } catch (_: Throwable) {
            false
          } finally {
            try {
              a.end()
            } catch (_: Throwable) {
            }
          }
          return ok
        }

        fun canInitSingle(p: String): Boolean {
          if (tryInitSingle(p)) return true
          try {
            ensureTraineddata(p, true, "tessdata_fast")
          } catch (_: Throwable) {
          }
          if (tryInitSingle(p)) return true
          try {
            ensureTraineddata(p, true, "tessdata")
          } catch (_: Throwable) {
          }
          return tryInitSingle(p)
        }

        val parts = lang.split("+").filter { it.isNotBlank() }
        for (p in parts) {
          if (!canInitSingle(p)) {
            bmp.recycle()
            invoke.reject("failed to init tesseract (lang=$p)")
            return@Thread
          }
        }

        val api = TessBaseAPI()
        val ok = api.init(dataPath, lang, TessBaseAPI.OEM_DEFAULT)
        if (!ok) {
          api.end()
          bmp.recycle()
          invoke.reject("failed to init tesseract (lang=$lang)")
          return@Thread
        }
        val text = try {
          api.pageSegMode = TessBaseAPI.PageSegMode.PSM_SINGLE_BLOCK
          api.setImage(bmp)
          api.utF8Text ?: ""
        } finally {
          api.end()
          bmp.recycle()
        }

        val out = JSObject().apply { put("text", text) }
        invoke.resolve(out)
      } catch (e: OutOfMemoryError) {
        invoke.reject("tesseractOcr failed: OutOfMemoryError")
      } catch (t: Throwable) {
        val msg = t.message?.trim().takeIf { !it.isNullOrEmpty() } ?: "tesseractOcr failed"
        invoke.reject("${t.javaClass.name}: $msg")
      }
    }.start()
  }

  @Command
  fun mlkitOcr(invoke: Invoke) {
    val args = invoke.getArgs()
    val imageBase64 = args.getString("imageBase64") ?: ""
    if (imageBase64.isBlank()) {
      invoke.reject("imageBase64 is required")
      return
    }

    Thread {
      try {
        val bytes = decodeBase64(imageBase64)
        val bmp = BitmapFactory.decodeByteArray(bytes, 0, bytes.size)
        if (bmp == null) {
          invoke.reject("failed to decode image")
          return@Thread
        }

        val image = InputImage.fromBitmap(bmp, 0)
        val recognizer = TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS)
        recognizer
          .process(image)
          .addOnSuccessListener { res ->
            try {
              val out = JSObject().apply { put("text", res.text ?: "") }
              invoke.resolve(out)
            } finally {
              bmp.recycle()
            }
          }
          .addOnFailureListener { e ->
            try {
              invoke.reject(e.message ?: "mlkitOcr failed")
            } finally {
              bmp.recycle()
            }
          }
      } catch (e: Exception) {
        invoke.reject(e.message ?: "mlkitOcr failed", e, null)
      }
    }.start()
  }

  private fun getEngine(modelPath: String): Engine {
    val existing = engine
    if (existing != null && engineModelPath == modelPath) return existing

    try {
      existing?.close()
    } catch (_: Exception) {
    }
    engine = null
    engineModelPath = null

    Engine.Companion.setNativeMinLogSeverity(LogSeverity.ERROR)
    val cacheDir = File(activity.cacheDir, "litertlm-cache").also { it.mkdirs() }.absolutePath
    val backend: Backend = Backend.CPU(null)
    val cfg = EngineConfig(modelPath, backend, backend, backend, 2048, 1, cacheDir)
    val eng = Engine(cfg)
    eng.initialize()
    engine = eng
    engineModelPath = modelPath
    return eng
  }

  @Command
  fun warmupGemma(invoke: Invoke) {
    try {
      val args = invoke.getArgs()
      val modelPath = args.getString("modelPath") ?: ""
      if (modelPath.isBlank()) {
        invoke.reject("modelPath is required")
        return
      }

      Thread {
        try {
          getEngine(modelPath)
        } catch (_: Throwable) {
        }
      }.start()

      val out = JSObject()
      out.put("ok", true)
      invoke.resolve(out)
    } catch (e: Exception) {
      invoke.reject(e.message ?: "warmupGemma failed", e, null)
    }
  }

  private fun messageToText(msg: Any): String {
    val s = msg.toString()
    if (s.isNotBlank()) return s.trim()
    return s
  }


  @Command
  fun gemmaOcr(invoke: Invoke) {
    val args = invoke.getArgs()
    val modelPath = args.getString("modelPath") ?: ""
    val imageBase64 = args.getString("imageBase64") ?: ""
    val prompt = args.getString("prompt") ?: ""
    if (modelPath.isBlank()) {
      invoke.reject("modelPath is required")
      return
    }
    if (imageBase64.isBlank()) {
      invoke.reject("imageBase64 is required")
      return
    }

    Thread {
      try {
        val eng = getEngine(modelPath)
        eng.createConversation(ConversationConfig()).use { conv ->
          val parts = ArrayList<Content>()
          parts.add(Content.ImageBytes(decodeBase64(imageBase64)))
          parts.add(Content.Text(prompt))
          val contents = Contents.Companion.of(parts)
          val msg = conv.sendMessage(contents, Collections.emptyMap())
          val text = messageToText(msg)
          val out = JSObject().apply { put("text", text) }
          invoke.resolve(out)
        }
      } catch (e: OutOfMemoryError) {
        try {
          engine?.close()
        } catch (_: Exception) {
        }
        engine = null
        engineModelPath = null
        invoke.reject(
          "Gemma OCR не вдався через нестачу пам'яті. Зменште область (ROI) або масштаб зображення та спробуйте ще раз."
        )
      } catch (e: Exception) {
        invoke.reject(e.message ?: "gemmaOcr failed", e, null)
      }
    }.start()
  }

  @Command
  fun cleanText(invoke: Invoke) {
    val args = invoke.getArgs()
    val modelPath = args.getString("modelPath") ?: ""
    val rawText = args.getString("rawText") ?: ""
    val prompt = args.getString("prompt") ?: ""
    if (modelPath.isBlank()) {
      invoke.reject("modelPath is required")
      return
    }

    Thread {
      try {
        val eng = getEngine(modelPath)
        eng.createConversation(ConversationConfig()).use { conv ->
          val parts = ArrayList<Content>()
          parts.add(Content.Text(prompt.ifBlank { rawText }))
          val contents = Contents.Companion.of(parts)
          val msg = conv.sendMessage(contents, Collections.emptyMap())
          val text = messageToText(msg)
          val out = JSObject().apply { put("text", text) }
          invoke.resolve(out)
        }
      } catch (e: OutOfMemoryError) {
        try {
          engine?.close()
        } catch (_: Exception) {
        }
        engine = null
        engineModelPath = null
        invoke.reject("cleanText не вдався через нестачу пам'яті. Спробуйте ще раз.")
      } catch (e: Exception) {
        invoke.reject(e.message ?: "cleanText failed", e, null)
      }
    }.start()
  }
}

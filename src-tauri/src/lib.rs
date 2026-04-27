use std::{
    env, fs,
    io::Cursor,
    path::{Path, PathBuf},
    process::{Command, Stdio},
};

use base64::{engine::general_purpose, Engine as _};
use exif::{In, Tag};
use futures_util::StreamExt;
use image::{imageops::FilterType, DynamicImage, ImageFormat};
use serde::{Deserialize, Serialize};
use tauri::{Emitter, Manager};

#[cfg(target_os = "android")]
#[derive(Clone)]
struct DezleksMobilePlugin(tauri::plugin::PluginHandle<tauri::Wry>);

#[cfg(not(target_os = "android"))]
#[derive(Clone)]
struct DezleksMobilePlugin;

fn dezleks_native_plugin() -> tauri::plugin::TauriPlugin<tauri::Wry> {
    tauri::plugin::Builder::new("dezleks_native")
        .setup(|app, api| {
            #[cfg(target_os = "android")]
            {
                let handle = api.register_android_plugin("com.dezleks.reader", "DezleksNativePlugin")?;
                app.manage(DezleksMobilePlugin(handle));
            }
            #[cfg(not(target_os = "android"))]
            {
                app.manage(DezleksMobilePlugin);
            }
            Ok(())
        })
        .build()
}

#[cfg(target_os = "android")]
#[derive(Debug, Serialize)]
struct AndroidTesseractOcrRequest {
    #[serde(rename = "imageBase64")]
    image_base64: String,
    lang: String,
}

#[cfg(target_os = "android")]
#[derive(Debug, Serialize)]
struct AndroidMlkitOcrRequest {
    #[serde(rename = "imageBase64")]
    image_base64: String,
}

#[cfg(target_os = "android")]
#[derive(Debug, Serialize)]
struct AndroidGemmaOcrRequest {
    #[serde(rename = "modelPath")]
    model_path: String,
    #[serde(rename = "imageBase64")]
    image_base64: String,
    prompt: String,
}

#[cfg(target_os = "android")]
#[derive(Debug, Serialize)]
struct AndroidCleanTextRequest {
    #[serde(rename = "modelPath")]
    model_path: String,
    #[serde(rename = "rawText")]
    raw_text: String,
    prompt: String,
}

#[cfg(target_os = "android")]
#[derive(Debug, Deserialize)]
struct AndroidTextResponse {
    text: String,
}

#[cfg(target_os = "android")]
#[derive(Debug, Serialize)]
struct AndroidWarmupGemmaRequest {
    #[serde(rename = "modelPath")]
    model_path: String,
}

#[cfg(target_os = "android")]
#[derive(Debug, Deserialize)]
struct AndroidOkResponse {
    ok: bool,
}

#[cfg(target_os = "android")]
#[derive(Debug, Serialize)]
struct AndroidEmptyRequest {}

#[cfg(target_os = "android")]
#[derive(Debug, Serialize)]
struct AndroidPrintTextRequest {
    text: String,
    #[serde(rename = "fontFamily")]
    font_family: String,
    #[serde(rename = "fontSizePx")]
    font_size_px: u32,
    #[serde(rename = "lineHeight")]
    line_height: f64,
    #[serde(rename = "textColor")]
    text_color: String,
}

#[cfg(target_os = "android")]
#[derive(Debug, Serialize)]
struct AndroidSpeakTextRequest {
    text: String,
    lang: String,
}

#[cfg(target_os = "android")]
#[derive(Debug, Deserialize)]
struct AndroidTakePhotoResponse {
    #[serde(rename = "imageBase64")]
    image_base64: String,
    mime: String,
}

#[derive(Debug, Clone, Deserialize)]
struct ImagePayload {
    #[serde(rename = "bytesBase64")]
    bytes_base64: String,
}

#[derive(Debug, Clone, Deserialize)]
struct Roi {
    x: u32,
    y: u32,
    w: u32,
    h: u32,
}

#[derive(Debug, Clone, Serialize)]
struct OcrResult {
    #[serde(rename = "rawText")]
    raw_text: String,
    engine: String,
}

#[derive(Debug, Clone, Serialize)]
struct ProcessedImage {
    #[serde(rename = "bytesBase64")]
    bytes_base64: String,
    width: u32,
    height: u32,
}

#[derive(Debug, Clone, Serialize)]
struct PhotoPayload {
    #[serde(rename = "bytesBase64")]
    bytes_base64: String,
    mime: String,
}

#[derive(Debug, Clone, Serialize)]
struct DownloadedModel {
    path: String,
}

#[derive(Debug, Clone, Serialize)]
struct ModelDownloadProgress {
    #[serde(rename = "downloadedBytes")]
    downloaded_bytes: u64,
    #[serde(rename = "totalBytes")]
    total_bytes: Option<u64>,
}

#[derive(Debug, Clone, Copy, Deserialize)]
struct Point {
    x: f64,
    y: f64,
}

#[derive(Debug, Clone, Copy, Deserialize)]
struct Quad {
    tl: Point,
    tr: Point,
    br: Point,
    bl: Point,
}

fn decode_image_bytes(image: &ImagePayload) -> Result<Vec<u8>, String> {
    general_purpose::STANDARD
        .decode(image.bytes_base64.as_bytes())
        .map_err(|e| format!("base64 decode error: {e}"))
}

fn exif_orientation(bytes: &[u8]) -> Option<u32> {
    let mut cursor = Cursor::new(bytes);
    let reader = exif::Reader::new();
    let exif = reader.read_from_container(&mut cursor).ok()?;
    let field = exif.get_field(Tag::Orientation, In::PRIMARY)?;
    field.value.get_uint(0)
}

fn normalize_orientation(bytes: &[u8], img: DynamicImage) -> DynamicImage {
    match exif_orientation(bytes) {
        Some(2) => img.fliph(),
        Some(3) => img.rotate180(),
        Some(4) => img.flipv(),
        Some(5) => img.rotate270().fliph(),
        Some(6) => img.rotate90(),
        Some(7) => img.rotate90().fliph(),
        Some(8) => img.rotate270(),
        _ => img,
    }
}

fn encode_png_base64(img: &DynamicImage) -> Result<ProcessedImage, String> {
    let mut png_bytes: Vec<u8> = Vec::new();
    img.write_to(&mut Cursor::new(&mut png_bytes), ImageFormat::Png)
        .map_err(|e| format!("encode png error: {e}"))?;
    Ok(ProcessedImage {
        bytes_base64: general_purpose::STANDARD.encode(png_bytes),
        width: img.width(),
        height: img.height(),
    })
}

fn downscale_for_gemma(img: DynamicImage) -> DynamicImage {
    let max_side: u32 = 1536;
    let w = img.width();
    let h = img.height();
    if w.max(h) <= max_side {
        return img;
    }
    img.resize(max_side, max_side, FilterType::Triangle)
}

fn downscale_for_preview(img: DynamicImage) -> DynamicImage {
    let max_side: u32 = 2048;
    let w = img.width();
    let h = img.height();
    if w.max(h) <= max_side {
        return img;
    }
    img.resize(max_side, max_side, FilterType::Triangle)
}

#[tauri::command(rename_all = "camelCase")]
async fn rotate_image(image: ImagePayload, direction: String) -> Result<ProcessedImage, String> {
    let bytes = decode_image_bytes(&image)?;
    let img = image::load_from_memory(&bytes).map_err(|e| format!("decode image error: {e}"))?;

    let dir = direction.trim().to_lowercase();
    let out = if dir == "left" {
        img.rotate270()
    } else if dir == "right" {
        img.rotate90()
    } else {
        return Err("direction must be 'left' or 'right'".to_string());
    };

    encode_png_base64(&out)
}

fn crop_roi(img: DynamicImage, roi: &Roi) -> Result<DynamicImage, String> {
    let iw = img.width();
    let ih = img.height();

    let x = roi.x.min(iw);
    let y = roi.y.min(ih);
    let max_w = iw.saturating_sub(x);
    let max_h = ih.saturating_sub(y);
    let w = roi.w.min(max_w);
    let h = roi.h.min(max_h);

    if w == 0 || h == 0 {
        return Err("ROI має нульовий розмір".to_string());
    }

    Ok(img.crop_imm(x, y, w, h))
}

fn run_tesseract_on_macos(cropped: DynamicImage, lang: &str) -> Result<String, String> {
    let dir = tempfile::tempdir().map_err(|e| format!("tempdir error: {e}"))?;
    let input_path = dir.path().join("input.png");
    let output_base = dir.path().join("out");

    let mut png_bytes: Vec<u8> = Vec::new();
    cropped
        .write_to(&mut Cursor::new(&mut png_bytes), ImageFormat::Png)
        .map_err(|e| format!("encode png error: {e}"))?;
    fs::write(&input_path, png_bytes).map_err(|e| format!("write temp image error: {e}"))?;

    let tesseract = if std::path::Path::new("/opt/homebrew/bin/tesseract").exists() {
        "/opt/homebrew/bin/tesseract"
    } else if std::path::Path::new("/usr/local/bin/tesseract").exists() {
        "/usr/local/bin/tesseract"
    } else {
        "tesseract"
    };

    let output = Command::new(tesseract)
        .arg(&input_path)
        .arg(&output_base)
        .arg("-l")
        .arg(lang)
        .arg("--psm")
        .arg("6")
        .stdin(Stdio::null())
        .stderr(Stdio::piped())
        .output()
        .map_err(|e| format!("tesseract запуск не вдався: {e}"))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
        return Err(if stderr.is_empty() {
            "tesseract завершився з помилкою".to_string()
        } else {
            stderr
        });
    }

    let out_txt = output_base.with_extension("txt");
    fs::read_to_string(out_txt).map_err(|e| format!("read tesseract output error: {e}"))
}

fn solve_8x8(mut a: [[f64; 8]; 8], mut b: [f64; 8]) -> Result<[f64; 8], String> {
    for i in 0..8 {
        let mut pivot = i;
        let mut pivot_val = a[i][i].abs();
        for (r, row) in a.iter().enumerate().skip(i + 1) {
            let v = row[i].abs();
            if v > pivot_val {
                pivot = r;
                pivot_val = v;
            }
        }

        if pivot_val < 1e-12 {
            return Err("Не вдалося обчислити матрицю перспективи".to_string());
        }

        if pivot != i {
            a.swap(i, pivot);
            b.swap(i, pivot);
        }

        let inv = 1.0 / a[i][i];
        for v in a[i].iter_mut().skip(i) {
            *v *= inv;
        }
        b[i] *= inv;

        let row_i = a[i];
        let bi = b[i];

        for r in 0..8 {
            if r == i {
                continue;
            }
            let factor = a[r][i];
            if factor.abs() < 1e-14 {
                continue;
            }
            for (c, v) in a[r].iter_mut().enumerate().skip(i) {
                *v -= factor * row_i[c];
            }
            b[r] -= factor * bi;
        }
    }

    Ok(b)
}

fn homography_from_4pts(dst: [Point; 4], src: [Point; 4]) -> Result<[f64; 9], String> {
    let mut a = [[0.0; 8]; 8];
    let mut b = [0.0; 8];

    for i in 0..4 {
        let x = dst[i].x;
        let y = dst[i].y;
        let u = src[i].x;
        let v = src[i].y;

        let r0 = i * 2;
        a[r0][0] = x;
        a[r0][1] = y;
        a[r0][2] = 1.0;
        a[r0][6] = -u * x;
        a[r0][7] = -u * y;
        b[r0] = u;

        let r1 = r0 + 1;
        a[r1][3] = x;
        a[r1][4] = y;
        a[r1][5] = 1.0;
        a[r1][6] = -v * x;
        a[r1][7] = -v * y;
        b[r1] = v;
    }

    let x = solve_8x8(a, b)?;
    Ok([x[0], x[1], x[2], x[3], x[4], x[5], x[6], x[7], 1.0])
}

fn bilinear_sample(img: &image::RgbaImage, x: f64, y: f64) -> image::Rgba<u8> {
    let w = img.width() as i32;
    let h = img.height() as i32;

    if x.is_nan() || y.is_nan() {
        return image::Rgba([255, 255, 255, 255]);
    }

    let x0 = x.floor() as i32;
    let y0 = y.floor() as i32;
    let x1 = x0 + 1;
    let y1 = y0 + 1;

    if x0 < 0 || y0 < 0 || x0 >= w || y0 >= h {
        return image::Rgba([255, 255, 255, 255]);
    }

    let fx = x - x0 as f64;
    let fy = y - y0 as f64;

    let p00 = img.get_pixel(x0 as u32, y0 as u32).0;
    let p10 = if x1 >= 0 && x1 < w {
        img.get_pixel(x1 as u32, y0 as u32).0
    } else {
        p00
    };
    let p01 = if y1 >= 0 && y1 < h {
        img.get_pixel(x0 as u32, y1 as u32).0
    } else {
        p00
    };
    let p11 = if x1 >= 0 && x1 < w && y1 >= 0 && y1 < h {
        img.get_pixel(x1 as u32, y1 as u32).0
    } else {
        p00
    };

    let mut out = [0u8; 4];
    for c in 0..4 {
        let v00 = p00[c] as f64;
        let v10 = p10[c] as f64;
        let v01 = p01[c] as f64;
        let v11 = p11[c] as f64;
        let v0 = v00 * (1.0 - fx) + v10 * fx;
        let v1 = v01 * (1.0 - fx) + v11 * fx;
        let v = v0 * (1.0 - fy) + v1 * fy;
        out[c] = v.round().clamp(0.0, 255.0) as u8;
    }
    image::Rgba(out)
}

fn quad_dimensions(q: Quad) -> (u32, u32) {
    fn dist(a: Point, b: Point) -> f64 {
        ((a.x - b.x).powi(2) + (a.y - b.y).powi(2)).sqrt()
    }
    let w = dist(q.tl, q.tr).max(dist(q.bl, q.br));
    let h = dist(q.tl, q.bl).max(dist(q.tr, q.br));
    (w.round().max(32.0) as u32, h.round().max(32.0) as u32)
}

#[tauri::command]
fn normalize_image(image: ImagePayload) -> Result<ProcessedImage, String> {
    let bytes = decode_image_bytes(&image)?;
    let img = image::load_from_memory(&bytes).map_err(|e| format!("decode image error: {e}"))?;
    let img = normalize_orientation(&bytes, img);
    let img = downscale_for_preview(img);
    encode_png_base64(&img)
}

#[tauri::command(rename_all = "camelCase")]
async fn warp_perspective(image: ImagePayload, quad: Quad) -> Result<ProcessedImage, String> {
    let bytes = decode_image_bytes(&image)?;
    let img = image::load_from_memory(&bytes).map_err(|e| format!("decode image error: {e}"))?;
    let img = normalize_orientation(&bytes, img).to_rgba8();

    let (out_w, out_h) = quad_dimensions(quad);
    let dw = out_w.saturating_sub(1) as f64;
    let dh = out_h.saturating_sub(1) as f64;

    let dst = [
        Point { x: 0.0, y: 0.0 },
        Point { x: dw, y: 0.0 },
        Point { x: dw, y: dh },
        Point { x: 0.0, y: dh },
    ];
    let src = [quad.tl, quad.tr, quad.br, quad.bl];
    let h = homography_from_4pts(dst, src)?;

    let mut out = image::RgbaImage::new(out_w, out_h);
    for y in 0..out_h {
        let yf = y as f64;
        for x in 0..out_w {
            let xf = x as f64;
            let denom = h[6] * xf + h[7] * yf + 1.0;
            if denom.abs() < 1e-12 {
                out.put_pixel(x, y, image::Rgba([255, 255, 255, 255]));
                continue;
            }
            let sx = (h[0] * xf + h[1] * yf + h[2]) / denom;
            let sy = (h[3] * xf + h[4] * yf + h[5]) / denom;
            let px = bilinear_sample(&img, sx, sy);
            out.put_pixel(x, y, px);
        }
    }

    let dyn_out = DynamicImage::ImageRgba8(out);
    encode_png_base64(&dyn_out)
}

#[tauri::command(rename_all = "camelCase")]
async fn take_photo(
    mobile: tauri::State<'_, DezleksMobilePlugin>,
) -> Result<PhotoPayload, String> {
    #[cfg(target_os = "android")]
    {
        let res = mobile
            .0
            .run_mobile_plugin::<AndroidTakePhotoResponse>("takePhoto", AndroidEmptyRequest {})
            .map_err(|e| format!("Не вдалося зробити фото: {e}"))?;
        return Ok(PhotoPayload {
            bytes_base64: res.image_base64,
            mime: res.mime,
        });
    }

    #[cfg(not(target_os = "android"))]
    {
        let _ = mobile;
        Err("Зробити фото підтримується лише на Android".to_string())
    }
}

#[tauri::command(rename_all = "camelCase")]
async fn ocr(
    app: tauri::AppHandle,
    mobile: tauri::State<'_, DezleksMobilePlugin>,
    image: ImagePayload,
    roi: Roi,
    lang: String,
    engine: String,
    model_path: Option<String>,
    ocr_prompt_override: Option<String>,
) -> Result<OcrResult, String> {
    if engine != "tesseract" && engine != "gemma" && engine != "mlkit" {
        return Err("Невідомий двигун OCR".to_string());
    }

    let bytes = decode_image_bytes(&image)?;

    let img = image::load_from_memory(&bytes).map_err(|e| format!("decode image error: {e}"))?;
    let img = normalize_orientation(&bytes, img);
    let mut cropped = crop_roi(img, &roi)?;
    if engine == "gemma" {
        cropped = downscale_for_gemma(cropped);
    }

    if engine == "gemma" {
        #[cfg(target_os = "macos")]
        {
            let model_path = model_path
                .and_then(|s| {
                    let t = s.trim().to_string();
                    if t.is_empty() { None } else { Some(t) }
                })
                .or_else(|| env::var("DEZLEKS_GEMMA_MODEL").ok())
                .ok_or_else(|| {
                    "Задайте шлях до моделі в налаштуваннях або через змінну середовища DEZLEKS_GEMMA_MODEL"
                        .to_string()
                })?;

            let text = run_gemma_ocr_macos_jvm(&app, cropped, &lang, &model_path)?;
            return Ok(OcrResult {
                raw_text: text,
                engine,
            });
        }

        #[cfg(target_os = "android")]
        {
            let model_path = model_path
                .and_then(|s| {
                    let t = s.trim().to_string();
                    if t.is_empty() { None } else { Some(t) }
                })
                .or_else(|| env::var("DEZLEKS_GEMMA_MODEL").ok())
                .ok_or_else(|| {
                    "Задайте шлях до моделі в налаштуваннях або через змінну середовища DEZLEKS_GEMMA_MODEL"
                        .to_string()
                })?;

            let cropped_png = encode_png_base64(&cropped)?.bytes_base64;
            let base_prompt = format!(
                "Витягни весь видимий текст з зображення.\n\
Поверни лише текст, зберігай переноси рядків.\n\
Без пояснень.\n\
Підказка щодо мов: {lang}\n"
            );
            let prompt = ocr_prompt_override
                .and_then(|s| {
                    let t = s.trim().to_string();
                    if t.is_empty() { None } else { Some(t) }
                })
                .map(|extra| format!("{base_prompt}\nДодаткові правила очищення:\n{extra}\n"))
                .unwrap_or(base_prompt);

            let text = mobile
                .0
                .run_mobile_plugin::<AndroidTextResponse>(
                    "gemmaOcr",
                    AndroidGemmaOcrRequest {
                        model_path,
                        image_base64: cropped_png,
                        prompt,
                    },
                )
                .map_err(|e| format!("Gemma OCR не вдався: {e}"))?
                .text;
            return Ok(OcrResult { raw_text: text, engine });
        }

        #[cfg(all(not(target_os = "macos"), not(target_os = "android")))]
        {
            let _ = cropped;
            let _ = model_path;
            let _ = ocr_prompt_override;
            return Err("Gemma OCR зараз реалізовано лише для macOS та Android".to_string());
        }
    }

    #[cfg(target_os = "macos")]
    {
        let _ = ocr_prompt_override;
        if engine == "mlkit" {
            let _ = cropped;
            let _ = lang;
            Err("Google ML Kit OCR підтримується лише на Android".to_string())
        } else {
            let text = run_tesseract_on_macos(cropped, &lang)?;
            Ok(OcrResult {
                raw_text: text,
                engine,
            })
        }
    }

    #[cfg(target_os = "android")]
    {
        let _ = ocr_prompt_override;
        let cropped_png = encode_png_base64(&cropped)?.bytes_base64;
        let text = if engine == "mlkit" {
            mobile
                .0
                .run_mobile_plugin::<AndroidTextResponse>(
                    "mlkitOcr",
                    AndroidMlkitOcrRequest {
                        image_base64: cropped_png,
                    },
                )
                .map_err(|e| format!("ML Kit OCR не вдався: {e}"))?
                .text
        } else {
            mobile
                .0
                .run_mobile_plugin::<AndroidTextResponse>(
                    "tesseractOcr",
                    AndroidTesseractOcrRequest {
                        image_base64: cropped_png,
                        lang,
                    },
                )
                .map_err(|e| format!("Tesseract OCR не вдався: {e}"))?
                .text
        };
        Ok(OcrResult { raw_text: text, engine })
    }

    #[cfg(all(not(target_os = "macos"), not(target_os = "android")))]
    {
        let _ = cropped;
        let _ = lang;
        let _ = engine;
        Err("OCR зараз реалізовано лише для macOS та Android".to_string())
    }
}

const GEMMA_OCR_RUNNER_JAVA: &str = r#"import com.google.ai.edge.litertlm.Backend;
import com.google.ai.edge.litertlm.Content;
import com.google.ai.edge.litertlm.Contents;
import com.google.ai.edge.litertlm.Conversation;
import com.google.ai.edge.litertlm.ConversationConfig;
import com.google.ai.edge.litertlm.Engine;
import com.google.ai.edge.litertlm.EngineConfig;
import com.google.ai.edge.litertlm.LogSeverity;
import com.google.ai.edge.litertlm.Message;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

public final class GemmaOcrRunner {
  private static Map<String, String> parseArgs(String[] argv) {
    Map<String, String> out = new HashMap<>();
    for (int i = 0; i < argv.length; i++) {
      String k = argv[i];
      if (!k.startsWith("--")) continue;
      String v = "";
      if (i + 1 < argv.length && !argv[i + 1].startsWith("--")) {
        v = argv[i + 1];
        i++;
      }
      out.put(k, v);
    }
    return out;
  }

  private static String req(Map<String, String> m, String k) {
    String v = m.get(k);
    if (v == null || v.trim().isEmpty()) throw new IllegalArgumentException("Missing " + k);
    return v.trim();
  }

  private static Backend backendFrom(String s) {
    String t = s == null ? "" : s.trim().toLowerCase();
    if (t.equals("gpu")) return new Backend.GPU();
    return new Backend.CPU();
  }

  private static String messageToText(Message msg) {
    StringBuilder sb = new StringBuilder();
    try {
      List<Content> parts = msg.getContents().getContents();
      for (Content c : parts) {
        if (c instanceof Content.Text) sb.append(((Content.Text) c).getText());
      }
    } catch (Throwable ignored) {
    }
    String out = sb.toString().trim();
    if (!out.isEmpty()) return out;
    return String.valueOf(msg);
  }

  public static void main(String[] argv) throws Exception {
    Map<String, String> args = parseArgs(argv);
    String modelPath = req(args, "--model");
    String imagePath = req(args, "--image");
    String promptFile = args.get("--prompt-file");
    String prompt = promptFile != null && !promptFile.trim().isEmpty()
        ? Files.readString(Path.of(promptFile.trim()))
        : args.getOrDefault("--prompt", "").trim();
    if (prompt.isEmpty()) {
      prompt = "Витягни весь видимий текст з зображення. Поверни лише текст, зберігай переноси рядків. Без пояснень.";
    }

    Backend backend = backendFrom(args.getOrDefault("--backend", "cpu"));
    Backend visionBackend = backendFrom(args.getOrDefault("--vision-backend", "cpu"));

    String cacheDir = args.get("--cache-dir");
    if (cacheDir == null || cacheDir.trim().isEmpty()) {
      cacheDir = System.getProperty("user.home") + "/.local/share/dezleks/tools/litertlm-cache";
    }
    Files.createDirectories(Path.of(cacheDir));

    Engine.Companion.setNativeMinLogSeverity(LogSeverity.ERROR);
    EngineConfig cfg = new EngineConfig(modelPath, backend, visionBackend, backend, 2048, 1, cacheDir);
    try (Engine engine = new Engine(cfg)) {
      engine.initialize();
      try (Conversation conv = engine.createConversation(new ConversationConfig())) {
        List<Content> parts = new ArrayList<>();
        parts.add(new Content.ImageFile(imagePath));
        parts.add(new Content.Text(prompt));
        Contents contents = Contents.Companion.of(parts);
        Message msg = conv.sendMessage(contents, Collections.emptyMap());
        System.out.print(messageToText(msg));
      }
    }
  }
}
"#;

#[cfg(target_os = "macos")]
fn gemma_ocr_tools_dir(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let base = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("не вдалося отримати app_data_dir: {e}"))?;
    Ok(base.join("tools").join("gemma-ocr-jvm"))
}

#[cfg(target_os = "macos")]
async fn download_file(url: &str, final_path: &Path) -> Result<(), String> {
    if final_path.exists() {
        return Ok(());
    }
    let tmp = final_path.with_extension("part");
    if let Some(parent) = final_path.parent() {
        tokio::fs::create_dir_all(parent)
            .await
            .map_err(|e| format!("не вдалося створити директорію: {e}"))?;
    }
    let client = reqwest::Client::new();
    let resp = client
        .get(url)
        .send()
        .await
        .map_err(|e| format!("завантаження не вдалося: {e}"))?;
    if !resp.status().is_success() {
        return Err(format!("сервер повернув статус {}", resp.status()));
    }
    let mut file = tokio::fs::File::create(&tmp)
        .await
        .map_err(|e| format!("не вдалося створити файл: {e}"))?;
    let mut stream = resp.bytes_stream();
    while let Some(chunk) = stream.next().await {
        let chunk = chunk.map_err(|e| format!("помилка читання потоку: {e}"))?;
        tokio::io::AsyncWriteExt::write_all(&mut file, &chunk)
            .await
            .map_err(|e| format!("помилка запису: {e}"))?;
    }
    tokio::io::AsyncWriteExt::flush(&mut file)
        .await
        .map_err(|e| format!("помилка flush: {e}"))?;
    drop(file);
    tokio::fs::rename(&tmp, final_path)
        .await
        .map_err(|e| format!("не вдалося зберегти файл: {e}"))?;
    Ok(())
}

#[cfg(target_os = "macos")]
#[tauri::command(rename_all = "camelCase")]
async fn ensure_gemma_ocr_runtime(app: tauri::AppHandle) -> Result<(), String> {
    let dir = gemma_ocr_tools_dir(&app)?;
    tokio::fs::create_dir_all(&dir)
        .await
        .map_err(|e| format!("не вдалося створити директорію інструментів: {e}"))?;

    let lib = dir.join("lib");
    tokio::fs::create_dir_all(&lib)
        .await
        .map_err(|e| format!("не вдалося створити lib: {e}"))?;

    let jars = [
        (
            "https://dl.google.com/dl/android/maven2/com/google/ai/edge/litertlm/litertlm-jvm/0.10.2/litertlm-jvm-0.10.2.jar",
            "litertlm-jvm-0.10.2.jar",
        ),
        (
            "https://repo1.maven.org/maven2/com/google/code/gson/gson/2.13.2/gson-2.13.2.jar",
            "gson-2.13.2.jar",
        ),
        (
            "https://repo1.maven.org/maven2/org/jetbrains/kotlin/kotlin-reflect/2.2.21/kotlin-reflect-2.2.21.jar",
            "kotlin-reflect-2.2.21.jar",
        ),
        (
            "https://repo1.maven.org/maven2/org/jetbrains/kotlin/kotlin-stdlib/2.2.21/kotlin-stdlib-2.2.21.jar",
            "kotlin-stdlib-2.2.21.jar",
        ),
        (
            "https://repo1.maven.org/maven2/org/jetbrains/kotlin/kotlin-stdlib-jdk7/2.2.21/kotlin-stdlib-jdk7-2.2.21.jar",
            "kotlin-stdlib-jdk7-2.2.21.jar",
        ),
        (
            "https://repo1.maven.org/maven2/org/jetbrains/kotlin/kotlin-stdlib-jdk8/2.2.21/kotlin-stdlib-jdk8-2.2.21.jar",
            "kotlin-stdlib-jdk8-2.2.21.jar",
        ),
        (
            "https://repo1.maven.org/maven2/org/jetbrains/kotlinx/kotlinx-coroutines-core-jvm/1.9.0/kotlinx-coroutines-core-jvm-1.9.0.jar",
            "kotlinx-coroutines-core-jvm-1.9.0.jar",
        ),
        (
            "https://repo1.maven.org/maven2/org/jetbrains/annotations/23.0.0/annotations-23.0.0.jar",
            "annotations-23.0.0.jar",
        ),
    ];

    for (url, name) in jars.iter() {
        download_file(url, &lib.join(name)).await?;
    }

    let src = dir.join("GemmaOcrRunner.java");
    let mut needs_rebuild = true;
    if let Ok(existing) = tokio::fs::read_to_string(&src).await {
        if existing == GEMMA_OCR_RUNNER_JAVA {
            needs_rebuild = false;
        }
    }
    if needs_rebuild {
        tokio::fs::write(&src, GEMMA_OCR_RUNNER_JAVA)
            .await
            .map_err(|e| format!("не вдалося записати Java runner: {e}"))?;
    }

    let out_dir = dir.join("out");
    tokio::fs::create_dir_all(&out_dir)
        .await
        .map_err(|e| format!("не вдалося створити out: {e}"))?;

    let runner_jar = dir.join("runner.jar");
    if runner_jar.exists() && !needs_rebuild {
        return Ok(());
    }
    if runner_jar.exists() && needs_rebuild {
        let _ = tokio::fs::remove_file(&runner_jar).await;
    }
    if needs_rebuild {
        let _ = tokio::fs::remove_dir_all(&out_dir).await;
        tokio::fs::create_dir_all(&out_dir)
            .await
            .map_err(|e| format!("не вдалося створити out: {e}"))?;
    }

    let mut cp_parts: Vec<String> = Vec::new();
    for (_, name) in jars.iter() {
        cp_parts.push(lib.join(*name).to_string_lossy().to_string());
    }
    let classpath = cp_parts.join(":");

    let javac = Command::new("javac")
        .arg("-cp")
        .arg(&classpath)
        .arg("-d")
        .arg(&out_dir)
        .arg(&src)
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .output()
        .map_err(|e| format!("javac запуск не вдався: {e}"))?;
    if !javac.status.success() {
        let stderr = String::from_utf8_lossy(&javac.stderr).trim().to_string();
        return Err(if stderr.is_empty() {
            "javac завершився з помилкою".to_string()
        } else {
            stderr
        });
    }

    let jar = Command::new("jar")
        .args(["--create", "--file"])
        .arg(&runner_jar)
        .args(["-C"])
        .arg(&out_dir)
        .arg("GemmaOcrRunner.class")
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .output()
        .map_err(|e| format!("jar запуск не вдався: {e}"))?;
    if !jar.status.success() {
        let stderr = String::from_utf8_lossy(&jar.stderr).trim().to_string();
        return Err(if stderr.is_empty() {
            "jar завершився з помилкою".to_string()
        } else {
            stderr
        });
    }

    Ok(())
}

#[cfg(not(target_os = "macos"))]
#[tauri::command(rename_all = "camelCase")]
async fn ensure_gemma_ocr_runtime(_app: tauri::AppHandle) -> Result<(), String> {
    #[cfg(target_os = "android")]
    {
        Ok(())
    }
    #[cfg(not(target_os = "android"))]
    {
        Err("Gemma OCR runtime зараз реалізовано лише для macOS та Android".to_string())
    }
}

#[cfg(target_os = "macos")]
fn run_gemma_ocr_macos_jvm(
    app: &tauri::AppHandle,
    cropped: DynamicImage,
    lang: &str,
    model_path: &str,
) -> Result<String, String> {
    let dir = gemma_ocr_tools_dir(app)?;
    let runner_jar = dir.join("runner.jar");
    let lib = dir.join("lib");
    if !runner_jar.exists() {
        return Err(
            "Gemma OCR не підготовлено. Спробуйте ще раз (підготовка запускається автоматично)."
                .to_string(),
        );
    }

    let tmp = tempfile::tempdir().map_err(|e| format!("не вдалося створити tempdir: {e}"))?;
    let img_path = tmp.path().join("roi.png");
    let prompt_path = tmp.path().join("prompt.txt");

    let img_rgba = cropped.to_rgba8();
    image::DynamicImage::ImageRgba8(img_rgba)
        .save_with_format(&img_path, image::ImageFormat::Png)
        .map_err(|e| format!("не вдалося зберегти тимчасове зображення: {e}"))?;

    let prompt = format!(
        "Витягни весь видимий текст з зображення.\n\
Поверни лише текст, зберігай переноси рядків.\n\
Без пояснень.\n\
Підказка щодо мов: {lang}\n"
    );
    std::fs::write(&prompt_path, prompt).map_err(|e| format!("не вдалося записати prompt: {e}"))?;

    let mut cp: Vec<String> = Vec::new();
    cp.push(runner_jar.to_string_lossy().to_string());
    let dep_names = [
        "litertlm-jvm-0.10.2.jar",
        "gson-2.13.2.jar",
        "kotlin-reflect-2.2.21.jar",
        "kotlin-stdlib-2.2.21.jar",
        "kotlin-stdlib-jdk7-2.2.21.jar",
        "kotlin-stdlib-jdk8-2.2.21.jar",
        "kotlinx-coroutines-core-jvm-1.9.0.jar",
        "annotations-23.0.0.jar",
    ];
    for n in dep_names {
        cp.push(lib.join(n).to_string_lossy().to_string());
    }
    let classpath = cp.join(":");

    let output = Command::new("java")
        .arg("-cp")
        .arg(classpath)
        .arg("GemmaOcrRunner")
        .args(["--backend", "cpu"])
        .args(["--vision-backend", "cpu"])
        .arg("--model")
        .arg(model_path)
        .arg("--image")
        .arg(img_path)
        .arg("--prompt-file")
        .arg(prompt_path)
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .output()
        .map_err(|e| format!("java запуск не вдався: {e}"))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
        return Err(if stderr.is_empty() {
            "Gemma OCR завершився з помилкою".to_string()
        } else {
            stderr
        });
    }

    let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
    if stdout.is_empty() {
        return Err("Gemma OCR повернув порожній результат".to_string());
    }
    Ok(stdout)
}

fn litert_lm_bin() -> String {
    if let Ok(v) = env::var("DEZLEKS_LITERT_LM_BIN") {
        let t = v.trim().to_string();
        if !t.is_empty() && std::path::Path::new(&t).exists() {
            return t;
        }
    }

    let fixed = ["/opt/homebrew/bin/litert-lm", "/usr/local/bin/litert-lm"];
    for p in fixed {
        if std::path::Path::new(p).exists() {
            return p.to_string();
        }
    }

    if let Ok(home) = env::var("HOME") {
        let home = PathBuf::from(home);
        let venv_bin = home.join(".local/share/dezleks/tools/litert-lm-venv/bin/litert-lm");
        let cands = [
            home.join(".local/bin/litert-lm"),
            home.join("Library/Python/3.13/bin/litert-lm"),
            home.join("Library/Python/3.12/bin/litert-lm"),
            home.join("Library/Python/3.11/bin/litert-lm"),
            home.join("Library/Python/3.10/bin/litert-lm"),
            venv_bin,
        ];
        for p in cands {
            if p.exists() {
                return p.to_string_lossy().to_string();
            }
        }
    }

    "litert-lm".to_string()
}

fn litert_venv_dir() -> Result<PathBuf, String> {
    let home = env::var("HOME").map_err(|e| format!("HOME env not set: {e}"))?;
    Ok(PathBuf::from(home).join(".local/share/dezleks/tools/litert-lm-venv"))
}

fn ensure_litert_lm_internal() -> Result<String, String> {
    let bin = litert_lm_bin();
    match Command::new(&bin)
        .arg("--help")
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .status()
    {
        Ok(_) => return Ok(bin),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => {}
        Err(e) => return Err(format!("Не вдалося запустити litert-lm: {e}")),
    }

    try_install_litert_lm()?;

    let bin = litert_lm_bin();
    Command::new(&bin)
        .arg("--help")
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .status()
        .map_err(|e| {
            if e.kind() == std::io::ErrorKind::NotFound {
                "Не знайдено litert-lm навіть після спроби встановлення".to_string()
            } else {
                format!("Не вдалося запустити litert-lm після встановлення: {e}")
            }
        })?;

    Ok(bin)
}

fn try_install_litert_lm() -> Result<(), String> {
    if Command::new("uv")
        .args(["tool", "install", "litert-lm"])
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .output()
        .map(|o| o.status.success())
        .unwrap_or(false)
    {
        return Ok(());
    }

    if Command::new("pipx")
        .args(["install", "litert-lm"])
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .output()
        .map(|o| o.status.success())
        .unwrap_or(false)
    {
        return Ok(());
    }

    let venv_dir = litert_venv_dir()?;
    if !venv_dir.exists() {
        fs::create_dir_all(&venv_dir)
            .map_err(|e| format!("не вдалося створити директорію для venv: {e}"))?;
        let out = Command::new("python3")
            .args(["-m", "venv"])
            .arg(&venv_dir)
            .stdin(Stdio::null())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .output()
            .map_err(|e| format!("не вдалося створити venv: {e}"))?;
        if !out.status.success() {
            let stderr = String::from_utf8_lossy(&out.stderr).trim().to_string();
            return Err(if stderr.is_empty() {
                "не вдалося створити venv".to_string()
            } else {
                stderr
            });
        }
    }

    let py = venv_dir.join("bin/python");
    let pip = venv_dir.join("bin/pip");
    if !py.exists() || !pip.exists() {
        return Err("venv створено, але python/pip не знайдено".to_string());
    }

    let up = Command::new(&py)
        .args(["-m", "pip", "install", "--upgrade", "pip"])
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .output()
        .map_err(|e| format!("не вдалося оновити pip у venv: {e}"))?;
    if !up.status.success() {
        let stderr = String::from_utf8_lossy(&up.stderr).trim().to_string();
        return Err(if stderr.is_empty() {
            "не вдалося оновити pip у venv".to_string()
        } else {
            stderr
        });
    }

    let ins = Command::new(&pip)
        .args(["install", "--upgrade", "litert-lm"])
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .output()
        .map_err(|e| format!("не вдалося встановити litert-lm у venv: {e}"))?;
    if !ins.status.success() {
        let stderr = String::from_utf8_lossy(&ins.stderr).trim().to_string();
        return Err(if stderr.is_empty() {
            "не вдалося встановити litert-lm у venv".to_string()
        } else {
            stderr
        });
    }

    let bin = venv_dir.join("bin/litert-lm");
    if !bin.exists() {
        return Err("litert-lm встановлено, але виконуваний файл не знайдено".to_string());
    }

    Ok(())
}

#[tauri::command(rename_all = "camelCase")]
async fn ensure_litert_lm() -> Result<String, String> {
    #[cfg(target_os = "android")]
    {
        return Ok("ok".to_string());
    }

    ensure_litert_lm_internal()
}

#[tauri::command(rename_all = "camelCase")]
async fn warmup_gemma(
    mobile: tauri::State<'_, DezleksMobilePlugin>,
    model_path: Option<String>,
) -> Result<String, String> {
    #[cfg(target_os = "android")]
    {
        let model_path = model_path
            .and_then(|s| {
                let t = s.trim().to_string();
                if t.is_empty() { None } else { Some(t) }
            })
            .or_else(|| env::var("DEZLEKS_GEMMA_MODEL").ok())
            .ok_or_else(|| {
                "Задайте шлях до моделі в налаштуваннях або через змінну середовища DEZLEKS_GEMMA_MODEL"
                    .to_string()
            })?;

        let _ = mobile
            .0
            .run_mobile_plugin::<AndroidOkResponse>(
                "warmupGemma",
                AndroidWarmupGemmaRequest { model_path },
            )
            .map_err(|e| format!("Не вдалося прогріти нейромережу: {e}"))?;

        return Ok("ok".to_string());
    }

    Ok("ok".to_string())
}

#[tauri::command(rename_all = "camelCase")]
async fn clean_text_gemma(
    mobile: tauri::State<'_, DezleksMobilePlugin>,
    raw_text: String,
    model_path: Option<String>,
    prompt_override: Option<String>,
) -> Result<String, String> {
    #[cfg(target_os = "android")]
    {
        let model_path = model_path
            .and_then(|s| {
                let t = s.trim().to_string();
                if t.is_empty() { None } else { Some(t) }
            })
            .or_else(|| env::var("DEZLEKS_GEMMA_MODEL").ok())
            .ok_or_else(|| {
                "Задайте шлях до моделі в налаштуваннях або через змінну середовища DEZLEKS_GEMMA_MODEL"
                    .to_string()
            })?;

        let prompt_override = prompt_override.and_then(|s| {
            let t = s.trim().to_string();
            if t.is_empty() { None } else { Some(t) }
        });
        let prompt = if let Some(p) = prompt_override {
            format!("{p}\n\nТекст:\n{raw_text}")
        } else {
            format!(
                "Ти редактор OCR українською.\n\
Виправ типові помилки розпізнавання: зайві символи, неправильні пробіли, перенос рядків, злиплі/розбиті слова, помилки пунктуації.\n\
Виправ орфографію, граматику та опечатки, якщо це не змінює зміст.\n\
Не додавай нового змісту. Не вигадуй відсутній текст. Не змінюй мову.\n\
Поверни тільки виправлений текст без пояснень.\n\n\
Текст:\n{raw_text}"
            )
        };

        let text = mobile
            .0
            .run_mobile_plugin::<AndroidTextResponse>(
                "cleanText",
                AndroidCleanTextRequest {
                    model_path,
                    raw_text,
                    prompt,
                },
            )
            .map_err(|e| format!("Нейромережа не відповіла: {e}"))?
            .text;
        return Ok(text.trim().to_string());
    }

    let litert_lm = ensure_litert_lm_internal()?;
    let model_path = model_path
        .and_then(|s| {
            let t = s.trim().to_string();
            if t.is_empty() {
                None
            } else {
                Some(t)
            }
        })
        .or_else(|| env::var("DEZLEKS_GEMMA_MODEL").ok())
        .ok_or_else(|| {
            "Задайте шлях до моделі в налаштуваннях або через змінну середовища DEZLEKS_GEMMA_MODEL"
                .to_string()
        })?;

    let prompt_override = prompt_override.and_then(|s| {
        let t = s.trim().to_string();
        if t.is_empty() { None } else { Some(t) }
    });
    let prompt = if let Some(p) = prompt_override {
        format!("{p}\n\nТекст:\n{raw_text}")
    } else {
        format!(
            "Ти редактор OCR українською.\n\
Виправ типові помилки розпізнавання: зайві символи, неправильні пробіли, перенос рядків, злиплі/розбиті слова, помилки пунктуації.\n\
Виправ орфографію, граматику та опечатки, якщо це не змінює зміст.\n\
Не додавай нового змісту. Не вигадуй відсутній текст. Не змінюй мову.\n\
Поверни тільки виправлений текст без пояснень.\n\n\
Текст:\n{raw_text}"
        )
    };

    let output = Command::new(litert_lm)
        .arg("run")
        .arg(model_path)
        .arg(format!("--prompt={prompt}"))
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .output()
        .map_err(|e| format!("litert-lm запуск не вдався: {e}"))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
        return Err(if stderr.is_empty() {
            "litert-lm завершився з помилкою".to_string()
        } else {
            stderr
        });
    }

    let stdout = String::from_utf8_lossy(&output.stdout).to_string();
    Ok(stdout.trim().to_string())
}

fn sanitize_filename(name: &str) -> String {
    let trimmed = name.trim();
    let mut out = String::with_capacity(trimmed.len());
    for ch in trimmed.chars() {
        let ok = ch.is_ascii_alphanumeric() || ch == '.' || ch == '_' || ch == '-' || ch == '+';
        out.push(if ok { ch } else { '_' });
    }
    if out.is_empty() {
        "model.litertlm".to_string()
    } else {
        out
    }
}

fn filename_from_url(url: &str) -> String {
    let no_query = url.split('?').next().unwrap_or(url);
    let no_hash = no_query.split('#').next().unwrap_or(no_query);
    let last = no_hash.rsplit('/').next().unwrap_or("model.litertlm");
    sanitize_filename(last)
}

fn model_dir(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let base = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("не вдалося отримати app_data_dir: {e}"))?;
    Ok(base.join("models"))
}

#[tauri::command(rename_all = "camelCase")]
async fn download_model(
    app: tauri::AppHandle,
    url: String,
    filename: Option<String>,
    bearer_token: Option<String>,
) -> Result<DownloadedModel, String> {
    let dir = model_dir(&app)?;
    fs::create_dir_all(&dir).map_err(|e| format!("не вдалося створити директорію моделей: {e}"))?;

    let filename = filename
        .and_then(|s| {
            let t = s.trim().to_string();
            if t.is_empty() {
                None
            } else {
                Some(sanitize_filename(&t))
            }
        })
        .unwrap_or_else(|| filename_from_url(&url));

    let final_path = dir.join(&filename);
    let tmp_path = dir.join(format!("{filename}.part"));

    let client = reqwest::Client::new();
    let mut req = client.get(&url);
    if let Some(token) = bearer_token {
        let t = token.trim();
        if !t.is_empty() {
            req = req.header(reqwest::header::AUTHORIZATION, format!("Bearer {t}"));
        }
    }

    let resp = req
        .send()
        .await
        .map_err(|e| format!("завантаження не вдалося: {e}"))?;

    if !resp.status().is_success() {
        return Err(format!("сервер повернув статус {}", resp.status()));
    }

    let total = resp.content_length();
    let mut downloaded: u64 = 0;

    let mut file = tokio::fs::File::create(&tmp_path)
        .await
        .map_err(|e| format!("не вдалося створити файл: {e}"))?;

    let mut stream = resp.bytes_stream();
    let mut last_emit: u64 = 0;
    while let Some(chunk) = stream.next().await {
        let chunk = chunk.map_err(|e| format!("помилка читання потоку: {e}"))?;
        tokio::io::AsyncWriteExt::write_all(&mut file, &chunk)
            .await
            .map_err(|e| format!("помилка запису: {e}"))?;
        downloaded = downloaded.saturating_add(chunk.len() as u64);

        if downloaded.saturating_sub(last_emit) >= 512 * 1024 {
            last_emit = downloaded;
            let _ = app.emit(
                "model_download_progress",
                ModelDownloadProgress {
                    downloaded_bytes: downloaded,
                    total_bytes: total,
                },
            );
        }
    }

    tokio::io::AsyncWriteExt::flush(&mut file)
        .await
        .map_err(|e| format!("помилка flush: {e}"))?;
    drop(file);

    tokio::fs::rename(&tmp_path, &final_path)
        .await
        .map_err(|e| format!("не вдалося зберегти файл: {e}"))?;

    let _ = app.emit(
        "model_download_progress",
        ModelDownloadProgress {
            downloaded_bytes: downloaded,
            total_bytes: total,
        },
    );

    Ok(DownloadedModel {
        path: final_path.to_string_lossy().to_string(),
    })
}

#[tauri::command(rename_all = "camelCase")]
async fn print_text(
    mobile: tauri::State<'_, DezleksMobilePlugin>,
    raw_text: String,
    font_family: Option<String>,
    font_size_px: Option<u32>,
    line_height: Option<f64>,
    text_color: Option<String>,
    background: Option<String>,
) -> Result<String, String> {
    #[cfg(target_os = "android")]
    {
        let text = raw_text.trim().to_string();
        if text.is_empty() {
            return Err("Немає тексту для друку".to_string());
        }
        let _ = background;
        let font_family = font_family.unwrap_or_else(|| "system".to_string());
        let font_size_px = font_size_px.unwrap_or(20);
        let line_height = line_height.unwrap_or(1.6);
        let text_color = text_color.unwrap_or_else(|| "#1a1a1a".to_string());
        let _ = mobile
            .0
            .run_mobile_plugin::<AndroidOkResponse>(
                "printText",
                AndroidPrintTextRequest {
                    text,
                    font_family,
                    font_size_px,
                    line_height,
                    text_color,
                },
            )
            .map_err(|e| format!("Не вдалося відкрити друк: {e}"))?;
        return Ok("ok".to_string());
    }

    #[cfg(not(target_os = "android"))]
    {
        let _ = mobile;
        let _ = raw_text;
        let _ = font_family;
        let _ = font_size_px;
        let _ = line_height;
        let _ = text_color;
        let _ = background;
        Err("Друк підтримується лише на Android".to_string())
    }
}

#[tauri::command(rename_all = "camelCase")]
async fn speak_text(
    mobile: tauri::State<'_, DezleksMobilePlugin>,
    raw_text: String,
    lang: Option<String>,
) -> Result<String, String> {
    #[cfg(target_os = "android")]
    {
        let text = raw_text.trim().to_string();
        if text.is_empty() {
            return Err("Немає тексту для озвучення".to_string());
        }
        let lang = lang
            .unwrap_or_else(|| "uk".to_string())
            .trim()
            .to_lowercase();
        let lang = if lang == "en" { "en" } else { "uk" }.to_string();

        let _ = mobile
            .0
            .run_mobile_plugin::<AndroidOkResponse>("speakText", AndroidSpeakTextRequest { text, lang })
            .map_err(|e| format!("Не вдалося озвучити текст: {e}"))?;
        return Ok("ok".to_string());
    }

    #[cfg(not(target_os = "android"))]
    {
        let _ = mobile;
        let _ = raw_text;
        let _ = lang;
        Err("Озвучення підтримується лише на Android".to_string())
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(dezleks_native_plugin())
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            normalize_image,
            rotate_image,
            warp_perspective,
            take_photo,
            ocr,
            clean_text_gemma,
            warmup_gemma,
            ensure_litert_lm,
            ensure_gemma_ocr_runtime,
            download_model,
            print_text,
            speak_text
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

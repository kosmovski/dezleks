const ui = {
  btnBack: document.getElementById("btnBack"),
  btnGoSettings: document.getElementById("btnGoSettings"),
  btnPickPhoto: document.getElementById("btnPickPhoto"),
  btnTakePhoto: document.getElementById("btnTakePhoto"),
  btnToggleWarp: document.getElementById("btnToggleWarp"),
  btnApplyWarp: document.getElementById("btnApplyWarp"),
  btnRotateLeft: document.getElementById("btnRotateLeft"),
  btnRotateRight: document.getElementById("btnRotateRight"),
  btnRecognize: document.getElementById("btnRecognize"),
  btnToggleTextSettings: document.getElementById("btnToggleTextSettings"),
  btnClean: document.getElementById("btnClean"),
  toggleAutoCorrect: document.getElementById("toggleAutoCorrect"),
  toggleAiClean: document.getElementById("toggleAiClean"),
  inputAiPrompt: document.getElementById("inputAiPrompt"),
  inputModelPath: document.getElementById("inputModelPath"),
  inputModelUrl: document.getElementById("inputModelUrl"),
  inputModelToken: document.getElementById("inputModelToken"),
  btnDownloadE2B: document.getElementById("btnDownloadE2B"),
  btnDownloadE4B: document.getElementById("btnDownloadE4B"),
  btnDownloadModel: document.getElementById("btnDownloadModel"),
  modelDownloadStatus: document.getElementById("modelDownloadStatus"),
  selectTheme: document.getElementById("selectTheme"),
  selectUiLang: document.getElementById("selectUiLang"),
  selectEngine: document.getElementById("selectEngine"),
  selectLang: document.getElementById("selectLang"),
  imgPreview: document.getElementById("imgPreview"),
  imageStage: document.getElementById("imageStage"),
  roiOverlay: document.getElementById("roiOverlay"),
  quadSvg: document.getElementById("quadSvg"),
  quadPoly: document.getElementById("quadPoly"),
  roiText: document.getElementById("roiText"),
  statusText: document.getElementById("statusText"),
  output: document.getElementById("output"),
  textSettings: document.getElementById("textSettings"),
  fileInput: document.getElementById("fileInput"),
  cameraInput: document.getElementById("cameraInput"),
  fontFamily: document.getElementById("fontFamily"),
  fontSize: document.getElementById("fontSize"),
  lineHeight: document.getElementById("lineHeight"),
  bgColor: document.getElementById("bgColor"),
  textColor: document.getElementById("textColor"),
  busyOverlay: document.getElementById("busyOverlay"),
  busyText: document.getElementById("busyText"),
  screens: {
    home: document.getElementById("screenHome"),
    settings: document.getElementById("screenSettings"),
    edit: document.getElementById("screenEdit"),
    result: document.getElementById("screenResult"),
  },
};

const storageKey = "dezleks.settings.v2";

const GEMMA4_E2B_URL =
  "https://huggingface.co/litert-community/gemma-4-E2B-it-litert-lm/resolve/main/gemma-4-E2B-it.litertlm";
const GEMMA4_E4B_URL =
  "https://huggingface.co/litert-community/gemma-4-E4B-it-litert-lm/resolve/main/gemma-4-E4B-it.litertlm";

const state = {
  nav: ["home"],
  mode: "roi",
  originalImage: null,
  workingImage: null,
  roi: null,
  quad: null,
  rawText: "",
  settings: {
    theme: "default",
    uiLang: "uk",
    engine: "tesseract",
    lang: "ukr+eng",
    autoCorrect: true,
    aiClean: true,
    aiPrompt: "",
    modelPath: "",
    modelUrl: "",
  },
  readingStyle: {
    fontFamily: "OpenDyslexic-Regular",
    fontSizePx: 20,
    lineHeight: 1.6,
    background: "#fff7e6",
    textColor: "#1a1a1a",
  },
};

const i18n = {
  uk: {
    "nav.back": "Назад",
    "nav.settings": "Налаштування",
    "status.ready": "Готово",
    "common.processing": "Обробка…",
    "common.on": "Увімкнено",
    "common.off": "Вимкнено",
    "home.title": "Старт",
    "home.hint": "Оберіть або зробіть фото з текстом. Далі можна виправити перспективу і виділити область для OCR.",
    "home.pickPhoto": "Обрати фото",
    "home.takePhoto": "Зробити фото",
    "settings.title": "Налаштування",
    "settings.theme": "Тема оформлення",
    "theme.default": "Темна (Стандартна)",
    "theme.lightBlue": "Світла (Блакитна)",
    "theme.darkPurple": "Темна (Фіолетова)",
    "theme.lightGreen": "Світла (Зелена)",
    "settings.uiLanguage": "Мова інтерфейсу",
    "lang.uk": "Українська",
    "lang.en": "English",
    "settings.ocrEngine": "Двигун OCR",
    "settings.engineTesseract": "Tesseract",
    "settings.engineMlkit": "Google ML Kit",
    "settings.engineGemma": "Gemma",
    "settings.ocrLanguages": "Мови OCR",
    "settings.startCorrection": "Корекція при старті",
    "settings.aiCleanup": "Очищення нейромережею",
    "settings.cleanupPrompt": "Промпт для очищення (Gemma)",
    "settings.cleanupPromptPlaceholder": "Порожньо — стандартний промпт.",
    "settings.modelPath": "Шлях до моделі (Gemma)",
    "settings.modelPathPlaceholder": "/path/to/model.task або .litertlm",
    "settings.modelUrl": "Посилання для завантаження моделі",
    "settings.downloadE2B": "Завантажити Gemma 4 E2B",
    "settings.downloadE4B": "Завантажити Gemma 4 E4B",
    "settings.modelToken": "Токен доступу (не зберігається)",
    "settings.downloadModel": "Завантажити модель",
    "edit.title": "Фото",
    "edit.hint": "За потреби натисніть “Корекція перспективи”, відрегулюйте 4 точки, застосуйте. Потім виділіть область тексту.",
    "edit.perspective": "Корекція перспективи",
    "edit.apply": "Застосувати",
    "edit.rotateLeft": "⟲ 90°",
    "edit.rotateRight": "⟳ 90°",
    "edit.recognize": "Розпізнати",
    "edit.photoAlt": "Фото",
    "result.title": "Результат",
    "result.viewSettings": "Налаштування вигляду",
    "result.clean": "Очистити (Gemma)",
    "result.font": "Шрифт",
    "result.systemFont": "Системний",
    "result.fontSize": "Розмір",
    "result.lineHeight": "Міжряддя",
    "result.background": "Фон",
    "result.textColor": "Текст",
    "status.prepareAi": "Підготовка нейромережі…",
    "errors.prepareAiFailed": "Не вдалося підготувати нейромережу",
    "errors.noBridge": "Немає нативного мосту (запустіть як Tauri застосунок)",
    "errors.enterModelUrl": "Вкажіть посилання на модель",
    "status.downloadingModel": "Завантаження моделі…",
    "status.modelDownloaded": "Модель завантажено",
    "errors.noModelPathReturned": "Не вдалося отримати шлях до моделі",
    "status.loadingPhoto": "Завантаження фото…",
    "errors.showImageFailed": "Не вдалося показати зображення",
    "status.chooseRoiOrFixPerspective": "Виділіть область або виправте перспективу",
    "errors.noPhoto": "Немає фото",
    "status.warping": "Корекція перспективи…",
    "status.warpDone": "Готово. Виділіть область тексту",
    "errors.pickPhotoFirst": "Спочатку оберіть фото",
    "status.recognizing": "Розпізнавання…",
    "status.recognizingTimer": "Розпізнавання... {time}с",
    "status.cleaningTimer": "Очищення... {time}с",
    "status.recognizingAvg": "(середній: {avg}с)",
    "status.roiNotSelectedRecognizeAll": "Область не вибрано — розпізнаю все фото",
    "errors.selectRoiFirst": "Спочатку виділіть область",
    "errors.modelPathRequiredForGemmaOcr": "Для Gemma OCR вкажіть шлях до моделі в налаштуваннях",
    "status.preparingGemmaOcr": "Підготовка Gemma OCR…",
    "status.recognizingGemma": "Розпізнавання (Gemma)…",
    "errors.emptyResultTryOther": "Нульовий результат. Спробуйте іншу область або мову OCR.",
    "status.cleaning": "Очищення…",
    "errors.ocrDoneCleanFailed": "OCR готово. Очищення не вдалося: {msg}",
    "errors.noTextToClean": "Немає тексту для очищення",
    "status.openingCamera": "Відкриваю камеру…",
    "errors.openCameraFailed": "Не вдалося відкрити камеру",
    "status.rotating": "Поворот…",
    "errors.rotateFailed": "Не вдалося повернути зображення",
    "errors.unknown": "Сталася помилка",
    "errors.cancelled": "Скасовано",
    "errors.roiZero": "Вибрана область порожня",
    "errors.unknownOcrEngine": "Невідомий двигун OCR",
    "errors.decodeImage": "Не вдалося декодувати зображення",
    "errors.imageRequired": "Потрібне зображення",
    "errors.modelPathRequired": "Потрібен шлях до моделі",
    "errors.rawTextRequired": "Потрібен текст",
    "errors.tesseractInitFailed": "Не вдалося ініціалізувати Tesseract",
    "errors.traineddataInvalid": "Файл мовних даних пошкоджений. Спробуйте ще раз.",
    "errors.tesseractFailed": "Tesseract OCR не вдався: {msg}",
    "errors.mlkitFailed": "ML Kit OCR не вдався: {msg}",
    "errors.gemmaFailed": "Gemma OCR не вдався: {msg}",
    "errors.aiNoResponse": "Нейромережа не відповіла: {msg}",
  },
  en: {
    "nav.back": "Back",
    "nav.settings": "Settings",
    "status.ready": "Ready",
    "common.processing": "Working…",
    "common.on": "On",
    "common.off": "Off",
    "home.title": "Start",
    "home.hint": "Pick a photo with text or take a new one. Then you can fix perspective and select a region for OCR.",
    "home.pickPhoto": "Choose photo",
    "home.takePhoto": "Take photo",
    "settings.title": "Settings",
    "settings.theme": "Theme",
    "theme.default": "Dark (Default)",
    "theme.lightBlue": "Light (Blue)",
    "theme.darkPurple": "Dark (Purple)",
    "theme.lightGreen": "Light (Green)",
    "settings.uiLanguage": "Interface language",
    "lang.uk": "Ukrainian",
    "lang.en": "English",
    "settings.ocrEngine": "OCR engine",
    "settings.engineTesseract": "Tesseract",
    "settings.engineMlkit": "Google ML Kit",
    "settings.engineGemma": "Gemma",
    "settings.ocrLanguages": "OCR languages",
    "settings.startCorrection": "Auto-correction on load",
    "settings.aiCleanup": "AI cleanup",
    "settings.cleanupPrompt": "Cleanup prompt (Gemma)",
    "settings.cleanupPromptPlaceholder": "Empty = default prompt.",
    "settings.modelPath": "Model path (Gemma)",
    "settings.modelPathPlaceholder": "/path/to/model.task or .litertlm",
    "settings.modelUrl": "Model download URL",
    "settings.downloadE2B": "Download Gemma 4 E2B",
    "settings.downloadE4B": "Download Gemma 4 E4B",
    "settings.modelToken": "Access token (not saved)",
    "settings.downloadModel": "Download model",
    "edit.title": "Photo",
    "edit.hint": "If needed, tap “Perspective correction”, adjust 4 points, apply, then select the text region.",
    "edit.perspective": "Perspective correction",
    "edit.apply": "Apply",
    "edit.rotateLeft": "⟲ 90°",
    "edit.rotateRight": "⟳ 90°",
    "edit.recognize": "Recognize",
    "edit.photoAlt": "Photo",
    "result.title": "Result",
    "result.viewSettings": "Reading settings",
    "result.clean": "Clean up (Gemma)",
    "result.font": "Font",
    "result.systemFont": "System",
    "result.fontSize": "Size",
    "result.lineHeight": "Line height",
    "result.background": "Background",
    "result.textColor": "Text",
    "status.prepareAi": "Preparing AI…",
    "errors.prepareAiFailed": "Failed to prepare AI",
    "errors.noBridge": "No native bridge (run as a Tauri app)",
    "errors.enterModelUrl": "Enter model URL",
    "status.downloadingModel": "Downloading model…",
    "status.modelDownloaded": "Model downloaded",
    "errors.noModelPathReturned": "Failed to get model path",
    "status.loadingPhoto": "Loading photo…",
    "errors.showImageFailed": "Failed to display image",
    "status.chooseRoiOrFixPerspective": "Select a region or fix perspective",
    "errors.noPhoto": "No photo",
    "status.warping": "Correcting perspective…",
    "status.warpDone": "Done. Select the text region",
    "errors.pickPhotoFirst": "Pick a photo first",
    "status.recognizing": "Recognizing…",
    "status.recognizingTimer": "Recognizing... {time}s",
    "status.cleaningTimer": "Cleaning... {time}s",
    "status.recognizingAvg": "(avg: {avg}s)",
    "status.roiNotSelectedRecognizeAll": "No region selected — recognizing the whole photo",
    "errors.selectRoiFirst": "Select a region first",
    "errors.modelPathRequiredForGemmaOcr": "For Gemma OCR, set the model path in Settings",
    "status.preparingGemmaOcr": "Preparing Gemma OCR…",
    "status.recognizingGemma": "Recognizing (Gemma)…",
    "errors.emptyResultTryOther": "Empty result. Try a different region or OCR language.",
    "status.cleaning": "Cleaning…",
    "errors.ocrDoneCleanFailed": "OCR done. Cleanup failed: {msg}",
    "errors.noTextToClean": "No text to clean",
    "status.openingCamera": "Opening camera…",
    "errors.openCameraFailed": "Failed to open camera",
    "status.rotating": "Rotating…",
    "errors.rotateFailed": "Failed to rotate image",
    "errors.unknown": "Something went wrong",
    "errors.cancelled": "Cancelled",
    "errors.roiZero": "The selected region is empty",
    "errors.unknownOcrEngine": "Unknown OCR engine",
    "errors.decodeImage": "Failed to decode image",
    "errors.imageRequired": "Image is required",
    "errors.modelPathRequired": "Model path is required",
    "errors.rawTextRequired": "Text is required",
    "errors.tesseractInitFailed": "Failed to initialize Tesseract",
    "errors.traineddataInvalid": "Language data file is invalid. Please try again.",
    "errors.tesseractFailed": "Tesseract OCR failed: {msg}",
    "errors.mlkitFailed": "ML Kit OCR failed: {msg}",
    "errors.gemmaFailed": "Gemma OCR failed: {msg}",
    "errors.aiNoResponse": "AI did not respond: {msg}",
  },
};

function currentUiLang() {
  const lang = (state.settings.uiLang || "uk").trim().toLowerCase();
  return lang === "en" ? "en" : "uk";
}

function t(key, vars = null) {
  const lang = currentUiLang();
  const dict = i18n[lang] || i18n.uk;
  const fallback = i18n.uk[key] || key;
  let out = dict[key] || fallback;
  if (vars && typeof vars === "object") {
    for (const [k, v] of Object.entries(vars)) {
      out = out.replaceAll(`{${k}}`, String(v));
    }
  }
  return out;
}

function extractErrorMessage(e) {
  if (e == null) return "";
  if (typeof e === "string") return e;
  if (typeof e?.message === "string") return e.message;
  try {
    return String(e);
  } catch {
    return "";
  }
}

function formatNativeError(e) {
  const raw = extractErrorMessage(e).trim();
  if (!raw) return t("errors.unknown");

  const rules = [
    { re: /^cancelled$/i, key: "errors.cancelled" },
    { re: /No native bridge/i, key: "errors.noBridge" },
    { re: /Немає нативного мосту/i, key: "errors.noBridge" },
    { re: /ROI має нульовий розмір/i, key: "errors.roiZero" },
    { re: /Unknown OCR engine|Невідомий двигун OCR/i, key: "errors.unknownOcrEngine" },
    { re: /decode image error/i, key: "errors.decodeImage" },
    { re: /imageBase64 is required/i, key: "errors.imageRequired" },
    { re: /modelPath is required/i, key: "errors.modelPathRequired" },
    { re: /rawText is required/i, key: "errors.rawTextRequired" },
    { re: /failed to init tesseract/i, key: "errors.tesseractInitFailed" },
    { re: /downloaded traineddata is invalid/i, key: "errors.traineddataInvalid" },
    { re: /Tesseract OCR не вдався: (.*)$/i, key: "errors.tesseractFailed", var: "msg" },
    { re: /Tesseract OCR failed: (.*)$/i, key: "errors.tesseractFailed", var: "msg" },
    { re: /ML Kit OCR не вдався: (.*)$/i, key: "errors.mlkitFailed", var: "msg" },
    { re: /ML Kit OCR failed: (.*)$/i, key: "errors.mlkitFailed", var: "msg" },
    { re: /Gemma OCR не вдався: (.*)$/i, key: "errors.gemmaFailed", var: "msg" },
    { re: /Gemma OCR failed: (.*)$/i, key: "errors.gemmaFailed", var: "msg" },
    { re: /Нейромережа не відповіла: (.*)$/i, key: "errors.aiNoResponse", var: "msg" },
    { re: /AI did not respond: (.*)$/i, key: "errors.aiNoResponse", var: "msg" },
  ];

  for (const r of rules) {
    const m = raw.match(r.re);
    if (!m) continue;
    if (r.var) return t(r.key, { [r.var]: m[1] || "" });
    return t(r.key);
  }

  return raw;
}

function applyLanguage() {
  const lang = currentUiLang();
  document.documentElement.lang = lang;
  document.querySelectorAll("[data-i18n]").forEach((el) => {
    const key = el.getAttribute("data-i18n");
    if (!key) return;
    el.textContent = t(key);
  });
  document.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
    const key = el.getAttribute("data-i18n-placeholder");
    if (!key) return;
    el.setAttribute("placeholder", t(key));
  });
  document.querySelectorAll("[data-i18n-alt]").forEach((el) => {
    const key = el.getAttribute("data-i18n-alt");
    if (!key) return;
    el.setAttribute("alt", t(key));
  });
}

function setStatus(text) {
  ui.statusText.textContent = text;
}

function setBusy(isBusy, text) {
  if (!ui.busyOverlay) return;
  if (isBusy) {
    if (ui.busyText) ui.busyText.textContent = text || t("common.processing");
    ui.busyOverlay.classList.remove("hidden");
    ui.busyOverlay.setAttribute("aria-hidden", "false");
    return;
  }
  ui.busyOverlay.classList.add("hidden");
  ui.busyOverlay.setAttribute("aria-hidden", "true");
}

function getBridge() {
  const t = window.__TAURI__;
  if (!t || !t.core || typeof t.core.invoke !== "function") return null;
  return t.core;
}

function getEventApi() {
  const t = window.__TAURI__;
  if (!t || !t.event || typeof t.event.listen !== "function") return null;
  return t.event;
}

async function ensureLiteRtLm(bridge) {
  if (!bridge) return false;
  try {
    await bridge.invoke("ensure_litert_lm");
    return true;
  } catch (e) {
    setStatus(formatNativeError(e));
    return false;
  }
}

function showScreen(name, { push = true } = {}) {
  for (const k of Object.keys(ui.screens)) ui.screens[k].classList.remove("screen--active");
  ui.screens[name].classList.add("screen--active");
  if (push) state.nav.push(name);
  ui.btnBack.style.visibility = state.nav.length > 1 ? "visible" : "hidden";
  ui.btnGoSettings.style.visibility = name === "settings" ? "hidden" : "visible";
  
  // Update bottom nav active state
  if (name === "settings") {
    ui.btnGoSettings.style.color = "var(--accent)";
  } else {
    ui.btnGoSettings.style.color = "var(--muted)";
  }
}

function goBack() {
  if (state.nav.length <= 1) return;
  state.nav.pop();
  const prev = state.nav[state.nav.length - 1];
  showScreen(prev, { push: false });
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function bytesToBase64(uint8) {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < uint8.length; i += chunk) {
    binary += String.fromCharCode.apply(null, uint8.subarray(i, i + chunk));
  }
  return btoa(binary);
}

async function fileToBytesBase64(file) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  return bytesToBase64(bytes);
}

function base64ToDataUrl(base64, mime) {
  return `data:${mime};base64,${base64}`;
}

function tryLoadSettings() {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return;
    if (parsed.readingStyle) state.readingStyle = { ...state.readingStyle, ...parsed.readingStyle };
    if (parsed.settings) state.settings = { ...state.settings, ...parsed.settings };
  } catch {
    return;
  }
}

function persistSettings() {
  try {
    localStorage.setItem(storageKey, JSON.stringify({ readingStyle: state.readingStyle, settings: state.settings }));
  } catch {
    return;
  }
}

function applyReadingStyle() {
  const style = state.readingStyle;
  const family =
    style.fontFamily === "system"
      ? "system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif"
      : `"${style.fontFamily}", system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif`;

  ui.output.style.fontFamily = family;
  ui.output.style.fontSize = `${style.fontSizePx}px`;
  ui.output.style.lineHeight = String(style.lineHeight);
  ui.output.style.background = style.background;
  ui.output.style.color = style.textColor;
}

function applyTheme() {
  const theme = state.settings.theme || "default";
  document.documentElement.setAttribute("data-theme", theme);
}

function updateSettingsControls() {
  if (ui.selectTheme) ui.selectTheme.value = state.settings.theme || "default";
  if (ui.selectUiLang) ui.selectUiLang.value = currentUiLang();
  ui.selectEngine.value = state.settings.engine;
  ui.selectLang.value = state.settings.lang;
  ui.toggleAutoCorrect.textContent = state.settings.autoCorrect ? t("common.on") : t("common.off");
  ui.toggleAiClean.textContent = state.settings.aiClean ? t("common.on") : t("common.off");
  if (ui.inputAiPrompt) ui.inputAiPrompt.value = state.settings.aiPrompt || "";
  ui.inputModelPath.value = state.settings.modelPath || "";
  if (ui.inputModelUrl) ui.inputModelUrl.value = state.settings.modelUrl || "";

  ui.fontFamily.value = state.readingStyle.fontFamily;
  ui.fontSize.value = String(state.readingStyle.fontSizePx);
  ui.lineHeight.value = String(state.readingStyle.lineHeight);
  ui.bgColor.value = state.readingStyle.background;
  ui.textColor.value = state.readingStyle.textColor;
}

function formatBytes(n) {
  if (!Number.isFinite(n) || n <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let i = 0;
  let v = n;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i += 1;
  }
  return `${v.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

function setModelDownloadStatus(text) {
  if (!ui.modelDownloadStatus) return;
  ui.modelDownloadStatus.textContent = text || "";
}

function warmupGemmaInBackground() {
  const bridge = getBridge();
  if (!bridge) return;
  const modelPath = (state.settings.modelPath || "").trim();
  if (!modelPath) return;
  bridge.invoke("warmup_gemma", { modelPath }).catch(() => {});
}

function setupModelDownloadListener() {
  const eventApi = getEventApi();
  if (!eventApi) return;
  eventApi.listen("model_download_progress", (ev) => {
    const p = ev?.payload;
    if (!p) return;
    const done = Number(p.downloadedBytes || 0);
    const total = p.totalBytes == null ? null : Number(p.totalBytes);
    const pct = total && total > 0 ? Math.round((done / total) * 100) : null;
    const label = pct == null ? `${formatBytes(done)}` : `${pct}% (${formatBytes(done)} / ${formatBytes(total)})`;
    setModelDownloadStatus(label);
    if (ui.busyOverlay && !ui.busyOverlay.classList.contains("hidden")) {
      if (ui.busyText) ui.busyText.textContent = `${t("status.downloadingModel")} ${label}`;
    }
  });
}

async function downloadModel({ urlOverride = null, filenameOverride = null } = {}) {
  const bridge = getBridge();
  if (!bridge) {
    setStatus(t("errors.noBridge"));
    return;
  }
  const url = (urlOverride || ui.inputModelUrl?.value || "").trim();
  if (!url) {
    setStatus(t("errors.enterModelUrl"));
    return;
  }

  setModelDownloadStatus("");
  setStatus(t("status.downloadingModel"));
  setBusy(true, t("status.downloadingModel"));
  if (ui.btnDownloadE2B) ui.btnDownloadE2B.disabled = true;
  if (ui.btnDownloadE4B) ui.btnDownloadE4B.disabled = true;
  if (ui.btnDownloadModel) ui.btnDownloadModel.disabled = true;

  try {
    const token = (ui.inputModelToken?.value || "").trim();
    const result = await bridge.invoke("download_model", {
      url,
      filename: filenameOverride,
      bearerToken: token ? token : null,
    });
    const path = result?.path || "";
    if (path) {
      state.settings.modelPath = path;
      state.settings.modelUrl = url;
      persistSettings();
      updateSettingsControls();
      warmupGemmaInBackground();
      setModelDownloadStatus(t("status.ready"));
      setStatus(t("status.modelDownloaded"));
    } else {
      setStatus(t("errors.noModelPathReturned"));
    }
  } catch (e) {
    setStatus(formatNativeError(e));
  } finally {
    setBusy(false);
    if (ui.btnDownloadE2B) ui.btnDownloadE2B.disabled = false;
    if (ui.btnDownloadE4B) ui.btnDownloadE4B.disabled = false;
    if (ui.btnDownloadModel) ui.btnDownloadModel.disabled = false;
  }
}

async function downloadGemmaPreset(kind) {
  const preset =
    kind === "e4b"
      ? { url: GEMMA4_E4B_URL, filename: "gemma-4-E4B-it.litertlm" }
      : { url: GEMMA4_E2B_URL, filename: "gemma-4-E2B-it.litertlm" };
  if (ui.inputModelUrl) ui.inputModelUrl.value = preset.url;
  state.settings.modelUrl = preset.url;
  persistSettings();
  updateSettingsControls();
  await downloadModel({ urlOverride: preset.url, filenameOverride: preset.filename });
}

function setOutputText(text) {
  ui.output.textContent = text || "";
}

function clearRoiBox() {
  const existing = ui.roiOverlay.querySelector(".roiBox");
  if (existing) existing.remove();
}

function ensureRoiBox() {
  let box = ui.roiOverlay.querySelector(".roiBox");
  if (!box) {
    box = document.createElement("div");
    box.className = "roiBox";
    ui.roiOverlay.appendChild(box);
  }
  return box;
}

function updateRoiText() {
  if (!state.roi) {
    ui.roiText.textContent = "—";
    return;
  }
  const r = state.roi;
  ui.roiText.textContent = `x=${r.x}, y=${r.y}, w=${r.w}, h=${r.h}`;
}

function currentImagePayload() {
  const img = state.workingImage;
  if (!img) return null;
  return { bytesBase64: img.bytesBase64 };
}

function resetQuadToCorners() {
  const nw = ui.imgPreview.naturalWidth || 0;
  const nh = ui.imgPreview.naturalHeight || 0;
  if (!nw || !nh) return;
  state.quad = {
    tl: { x: 0, y: 0 },
    tr: { x: nw - 1, y: 0 },
    br: { x: nw - 1, y: nh - 1 },
    bl: { x: 0, y: nh - 1 },
  };
}

function ensureHandles() {
  let handles = ui.roiOverlay.querySelectorAll(".handle");
  if (handles.length === 4) return Array.from(handles);
  ui.roiOverlay.querySelectorAll(".handle").forEach((n) => n.remove());
  const names = ["tl", "tr", "br", "bl"];
  const out = [];
  for (const name of names) {
    const h = document.createElement("div");
    h.className = "handle";
    h.dataset.corner = name;
    ui.roiOverlay.appendChild(h);
    out.push(h);
  }
  return out;
}

function hideHandlesAndQuad() {
  ui.quadPoly.setAttribute("points", "");
  ui.quadSvg.style.display = "none";
  ui.roiOverlay.querySelectorAll(".handle").forEach((n) => n.remove());
}

function showHandlesAndQuad() {
  ui.quadSvg.style.display = "block";
  ensureHandles();
  updateQuadOverlay();
}

function imagePointToStagePx(pt, stageRect, imgRect) {
  const nw = ui.imgPreview.naturalWidth || 0;
  const nh = ui.imgPreview.naturalHeight || 0;
  if (!nw || !nh) return null;
  const sx = imgRect.width / nw;
  const sy = imgRect.height / nh;
  return {
    x: imgRect.left - stageRect.left + pt.x * sx,
    y: imgRect.top - stageRect.top + pt.y * sy,
  };
}

function stagePxToImagePoint(stageX, stageY, stageRect, imgRect) {
  const nw = ui.imgPreview.naturalWidth || 0;
  const nh = ui.imgPreview.naturalHeight || 0;
  if (!nw || !nh) return null;
  const xInImg = stageX - (imgRect.left - stageRect.left);
  const yInImg = stageY - (imgRect.top - stageRect.top);
  const ix = (xInImg / imgRect.width) * nw;
  const iy = (yInImg / imgRect.height) * nh;
  return { x: clamp(ix, 0, nw - 1), y: clamp(iy, 0, nh - 1) };
}

function updateQuadOverlay() {
  if (state.mode !== "warp" || !state.quad) return;
  const stageRect = ui.imageStage.getBoundingClientRect();
  const imgRect = ui.imgPreview.getBoundingClientRect();
  if (!stageRect.width || !stageRect.height) return;

  ui.quadSvg.setAttribute("viewBox", `0 0 ${stageRect.width} ${stageRect.height}`);

  const pts = [state.quad.tl, state.quad.tr, state.quad.br, state.quad.bl].map((p) =>
    imagePointToStagePx(p, stageRect, imgRect),
  );
  if (pts.some((p) => !p)) return;
  const pointsStr = pts.map((p) => `${p.x},${p.y}`).join(" ");
  ui.quadPoly.setAttribute("points", pointsStr);

  const handles = ensureHandles();
  const corners = ["tl", "tr", "br", "bl"];
  for (let i = 0; i < handles.length; i++) {
    const hp = pts[i];
    handles[i].style.left = `${hp.x}px`;
    handles[i].style.top = `${hp.y}px`;
    handles[i].dataset.corner = corners[i];
  }
}

function overlayToImageRoi(imgRect, roiRect) {
  const displayW = imgRect.width;
  const displayH = imgRect.height;
  const naturalW = ui.imgPreview.naturalWidth || 0;
  const naturalH = ui.imgPreview.naturalHeight || 0;
  if (!displayW || !displayH || !naturalW || !naturalH) return null;

  const x0 = clamp(roiRect.x, 0, displayW);
  const y0 = clamp(roiRect.y, 0, displayH);
  const x1 = clamp(roiRect.x + roiRect.w, 0, displayW);
  const y1 = clamp(roiRect.y + roiRect.h, 0, displayH);

  const sx = naturalW / displayW;
  const sy = naturalH / displayH;

  const ix = Math.round(x0 * sx);
  const iy = Math.round(y0 * sy);
  const iw = Math.round((x1 - x0) * sx);
  const ih = Math.round((y1 - y0) * sy);

  return { x: ix, y: iy, w: iw, h: ih };
}

function installOverlayInteractions() {
  let draggingRoi = false;
  let roiStart = null;
  let stageRect = null;
  let imgRect = null;

  let draggingCorner = null;

  ui.roiOverlay.addEventListener("pointerdown", (e) => {
    if (!state.workingImage) return;
    stageRect = ui.imageStage.getBoundingClientRect();
    imgRect = ui.imgPreview.getBoundingClientRect();

    const targetHandle = e.target?.classList?.contains("handle") ? e.target : null;
    if (state.mode === "warp" && targetHandle && state.quad) {
      ui.roiOverlay.setPointerCapture(e.pointerId);
      draggingCorner = targetHandle.dataset.corner;
      return;
    }

    if (state.mode !== "roi") return;
    if (e.clientX < imgRect.left || e.clientX > imgRect.right || e.clientY < imgRect.top || e.clientY > imgRect.bottom) return;
    ui.roiOverlay.setPointerCapture(e.pointerId);
    draggingRoi = true;
    roiStart = { x: e.clientX - imgRect.left, y: e.clientY - imgRect.top };
    clearRoiBox();
  });

  ui.roiOverlay.addEventListener("pointermove", (e) => {
    if (!state.workingImage) return;
    if (!imgRect || !stageRect) return;

    if (state.mode === "warp" && draggingCorner && state.quad) {
      const sx = clamp(e.clientX, imgRect.left, imgRect.right) - stageRect.left;
      const sy = clamp(e.clientY, imgRect.top, imgRect.bottom) - stageRect.top;
      const pt = stagePxToImagePoint(sx, sy, stageRect, imgRect);
      if (!pt) return;
      state.quad[draggingCorner] = pt;
      updateQuadOverlay();
      return;
    }

    if (!draggingRoi || !roiStart) return;
    const x = clamp(e.clientX, imgRect.left, imgRect.right) - imgRect.left;
    const y = clamp(e.clientY, imgRect.top, imgRect.bottom) - imgRect.top;

    const left = Math.min(roiStart.x, x);
    const top = Math.min(roiStart.y, y);
    const w = Math.abs(x - roiStart.x);
    const h = Math.abs(y - roiStart.y);

    const box = ensureRoiBox();
    box.style.left = `${imgRect.left - stageRect.left + left}px`;
    box.style.top = `${imgRect.top - stageRect.top + top}px`;
    box.style.width = `${w}px`;
    box.style.height = `${h}px`;

    const imgRoi = overlayToImageRoi(imgRect, { x: left, y: top, w, h });
    if (imgRoi) {
      state.roi = imgRoi.w >= 10 && imgRoi.h >= 10 ? imgRoi : null;
      updateRoiText();
    }
  });

  ui.roiOverlay.addEventListener("pointerup", () => {
    draggingRoi = false;
    roiStart = null;
    draggingCorner = null;
    stageRect = null;
    imgRect = null;
  });

  window.addEventListener("resize", () => {
    updateQuadOverlay();
  });
}

async function setWorkingImageFromBase64(bytesBase64, width, height) {
  state.workingImage = { bytesBase64, width, height, mime: "image/png" };
  ui.imgPreview.src = base64ToDataUrl(bytesBase64, "image/png");
  await new Promise((resolve, reject) => {
    ui.imgPreview.onload = () => resolve();
    ui.imgPreview.onerror = () => reject(new Error(t("errors.showImageFailed")));
  });
  ui.imgPreview.style.display = "block";
}

async function loadPhotoFromBytesBase64(bytesBase64, mime = "image/jpeg") {
  setStatus(t("status.loadingPhoto"));
  setBusy(true, t("status.loadingPhoto"));
  await new Promise((resolve) => setTimeout(resolve, 50));
  state.roi = null;
  updateRoiText();
  clearRoiBox();
  hideHandlesAndQuad();
  state.mode = "roi";
  ui.btnToggleWarp.textContent = t("edit.perspective");
  ui.btnApplyWarp.style.display = "none";
  ui.btnRecognize.disabled = false;

  state.originalImage = { bytesBase64, mime: mime || "image/jpeg" };
  state.workingImage = { bytesBase64, mime: mime || "image/jpeg" };

  ui.imgPreview.src = base64ToDataUrl(bytesBase64, mime || "image/jpeg");
  await new Promise((resolve, reject) => {
    ui.imgPreview.onload = () => resolve();
    ui.imgPreview.onerror = () => reject(new Error(t("errors.showImageFailed")));
  });
  ui.imgPreview.style.display = "block";
  setBusy(false);

  resetQuadToCorners();
  showScreen("edit");
  setStatus(t("status.chooseRoiOrFixPerspective"));
}

async function loadPhoto(file) {
  setStatus(t("status.loadingPhoto"));
  setBusy(true, t("status.loadingPhoto"));
  await new Promise((resolve) => setTimeout(resolve, 50));
  state.roi = null;
  updateRoiText();
  clearRoiBox();
  hideHandlesAndQuad();
  state.mode = "roi";
  ui.btnToggleWarp.textContent = t("edit.perspective");
  ui.btnApplyWarp.style.display = "none";
  ui.btnRecognize.disabled = false;

  const base64 = await fileToBytesBase64(file);
  state.originalImage = { bytesBase64: base64, mime: file.type || "image/jpeg" };
  state.workingImage = { bytesBase64: base64, mime: file.type || "image/jpeg" };

  ui.imgPreview.src = URL.createObjectURL(file);
  await new Promise((resolve) => (ui.imgPreview.onload = () => resolve()));
  ui.imgPreview.style.display = "block";
  setBusy(false);

  resetQuadToCorners();
  showScreen("edit");
  setStatus(t("status.chooseRoiOrFixPerspective"));
}

async function rotateWorkingImage(direction) {
  const bridge = getBridge();
  if (!bridge) {
    setStatus(t("errors.noBridge"));
    return;
  }
  if (!state.workingImage) return;
  setStatus(t("status.rotating"));
  setBusy(true, t("status.rotating"));
  await new Promise((resolve) => setTimeout(resolve, 50));
  try {
    const rotated = await bridge.invoke("rotate_image", {
      image: currentImagePayload(),
      direction,
    });
    await setWorkingImageFromBase64(rotated.bytesBase64, rotated.width, rotated.height);
    state.roi = null;
    updateRoiText();
    clearRoiBox();
    hideHandlesAndQuad();
    state.mode = "roi";
    ui.btnToggleWarp.textContent = t("edit.perspective");
    ui.btnApplyWarp.style.display = "none";
    ui.btnRecognize.disabled = false;
    resetQuadToCorners();
    setStatus(t("status.ready"));
  } catch (e) {
    setStatus(formatNativeError(e));
  } finally {
    setBusy(false);
  }
}

function toggleWarpMode() {
  if (!state.workingImage) return;
  if (state.mode === "warp") {
    applyWarp();
    return;
  }
  state.mode = "warp";
  ui.btnToggleWarp.textContent = t("edit.apply");
  ui.btnApplyWarp.style.display = "none";
  ui.btnRecognize.disabled = true;
  clearRoiBox();
  state.roi = null;
  updateRoiText();
  if (!state.quad) resetQuadToCorners();
  showHandlesAndQuad();
}

async function applyWarp() {
  if (!state.workingImage || !state.quad) {
    setStatus(t("errors.noPhoto"));
    return;
  }
  const bridge = getBridge();
  if (!bridge) {
    setStatus(t("errors.noBridge"));
    return;
  }

  setStatus(t("status.warping"));
  setBusy(true, t("status.warping"));
  await new Promise((resolve) => setTimeout(resolve, 50));
  ui.btnApplyWarp.disabled = true;
  ui.btnToggleWarp.disabled = true;
  ui.btnRecognize.disabled = true;

  try {
    const result = await bridge.invoke("warp_perspective", { image: currentImagePayload(), quad: state.quad });
    await setWorkingImageFromBase64(result.bytesBase64, result.width, result.height);
    state.roi = null;
    updateRoiText();
    clearRoiBox();
    resetQuadToCorners();
    state.mode = "roi";
    ui.btnToggleWarp.textContent = t("edit.perspective");
    ui.btnApplyWarp.style.display = "none";
    ui.btnRecognize.disabled = false;
    hideHandlesAndQuad();
    setStatus(t("status.warpDone"));
  } catch (e) {
    setStatus(formatNativeError(e));
  } finally {
    setBusy(false);
    ui.btnApplyWarp.disabled = false;
    ui.btnToggleWarp.disabled = false;
    ui.btnRecognize.disabled = false;
  }
}

let avgTimes = JSON.parse(localStorage.getItem("dezleks_avg_times") || "{}");

function getAvgTimeSec(engine) {
  const data = avgTimes[engine];
  if (!data || data.count === 0) return null;
  return (data.sum / data.count / 1000).toFixed(1);
}

function addTimeRecord(engine, durationMs) {
  if (!avgTimes[engine]) avgTimes[engine] = { sum: 0, count: 0 };
  avgTimes[engine].sum += durationMs;
  avgTimes[engine].count += 1;
  localStorage.setItem("dezleks_avg_times", JSON.stringify(avgTimes));
}

function startRecognitionTimer(engine) {
  const startTime = Date.now();
  const avgSec = getAvgTimeSec(engine);
  let currentPrefixKey = "status.recognizingTimer";
  
  const update = () => {
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    let text = t(currentPrefixKey, { time: elapsed });
    if (avgSec) {
      text += ` ` + t("status.recognizingAvg", { avg: avgSec });
    }
    setStatus(text);
    if (ui.busyText) ui.busyText.textContent = text;
  };
  
  update();
  const timerId = setInterval(update, 100);
  
  let stopped = false;
  return {
    setPrefix: (key) => {
      currentPrefixKey = key;
      update();
    },
    stop: () => {
      if (stopped) return;
      stopped = true;
      clearInterval(timerId);
      const durationMs = Date.now() - startTime;
      addTimeRecord(engine, durationMs);
      
      // Show final time
      const finalElapsed = (durationMs / 1000).toFixed(1);
      let text = t(currentPrefixKey, { time: finalElapsed });
      if (avgSec) {
        text += ` ` + t("status.recognizingAvg", { avg: avgSec });
      }
      setStatus(text);
    }
  };
}

async function recognize() {
  if (!state.workingImage) {
    setStatus(t("errors.pickPhotoFirst"));
    return;
  }

  setStatus(t("status.recognizing"));
  setBusy(true, t("status.recognizing"));
  await new Promise((resolve) => setTimeout(resolve, 50));

  if (!state.roi) {
    const nw = ui.imgPreview.naturalWidth || 0;
    const nh = ui.imgPreview.naturalHeight || 0;
    if (nw && nh) {
      state.roi = { x: 0, y: 0, w: nw, h: nh };
      updateRoiText();
      setStatus(t("status.roiNotSelectedRecognizeAll"));
    } else {
      setStatus(t("errors.selectRoiFirst"));
      setBusy(false);
      return;
    }
  }

  const bridge = getBridge();
  if (!bridge) {
    setStatus(t("errors.noBridge"));
    setBusy(false);
    return;
  }

  ui.btnRecognize.disabled = true;
  
  const engineToUse = state.settings.engine;
  const shouldClean = state.settings.aiClean || engineToUse === "gemma";
  const timerEngineKey = shouldClean ? `${engineToUse}_clean` : engineToUse;
  const timer = startRecognitionTimer(timerEngineKey);

  try {
    const modelPath = state.settings.modelPath?.trim() || "";
    if (engineToUse === "gemma") {
      if (!modelPath) {
        timer.stop();
        setStatus(t("errors.modelPathRequiredForGemmaOcr"));
        return;
      }
      await bridge.invoke("ensure_gemma_ocr_runtime");
    }

    const result = await bridge.invoke("ocr", {
      image: currentImagePayload(),
      roi: state.roi,
      lang: state.settings.lang,
      engine: engineToUse,
      modelPath: modelPath || null,
    });
    state.rawText = result?.rawText || "";
    if (!state.rawText.trim()) {
      timer.stop();
      setStatus(t("errors.emptyResultTryOther"));
      return;
    }
    setOutputText(state.rawText);
    ui.textSettings.classList.add("settings--hidden");
    showScreen("result");

    if (shouldClean) {
      const ok = await ensureLiteRtLm(bridge);
      if (!ok) {
        timer.stop();
        return;
      }
      timer.setPrefix("status.cleaningTimer");
      try {
        const promptOverride = (state.settings.aiPrompt || "").trim();
        const cleaned = await bridge.invoke("clean_text_gemma", {
          rawText: state.rawText,
          modelPath: modelPath || null,
          promptOverride: promptOverride ? promptOverride : null,
        });
        const nextText = String(cleaned || "");
        if (nextText.trim()) {
          state.rawText = nextText;
          setOutputText(state.rawText);
        }
        setStatus(t("status.ready"));
      } catch (e) {
        const msg = String(e?.message || e || "");
        setStatus(t("errors.ocrDoneCleanFailed", { msg }));
      }
    } else {
      setStatus(t("status.ready"));
    }
  } catch (e) {
    setStatus(formatNativeError(e));
  } finally {
    timer.stop();
    setBusy(false);
    ui.btnRecognize.disabled = false;
  }
}

async function cleanWithGemma() {
  const bridge = getBridge();
  if (!bridge) {
    setStatus(t("errors.noBridge"));
    return;
  }
  if (!state.rawText.trim()) {
    setStatus(t("errors.noTextToClean"));
    return;
  }

  setBusy(true, t("status.cleaning"));
  await new Promise((resolve) => setTimeout(resolve, 50));
  ui.btnClean.disabled = true;
  
  const timer = startRecognitionTimer("manual_clean");
  timer.setPrefix("status.cleaningTimer");

  try {
    const ok = await ensureLiteRtLm(bridge);
    if (!ok) return;
    const promptOverride = (state.settings.aiPrompt || "").trim();
    const cleaned = await bridge.invoke("clean_text_gemma", {
      rawText: state.rawText,
      modelPath: state.settings.modelPath || null,
      promptOverride: promptOverride ? promptOverride : null,
    });
    state.rawText = cleaned || "";
    setOutputText(state.rawText);
    setStatus(t("status.ready"));
  } catch (e) {
    const msg = String(e?.message || e || "");
    setStatus(formatNativeError(msg));
  } finally {
    timer.stop();
    setBusy(false);
    ui.btnClean.disabled = false;
  }
}

function wireUi() {
  ui.btnBack.addEventListener("click", goBack);
  ui.btnGoSettings.addEventListener("click", () => showScreen("settings"));

  ui.btnPickPhoto.addEventListener("click", () => ui.fileInput.click());
  ui.btnTakePhoto.addEventListener("click", async () => {
    const bridge = getBridge();
    if (bridge && /Android/i.test(navigator.userAgent || "")) {
      setStatus(t("status.openingCamera"));
      setBusy(true, t("status.openingCamera"));
      try {
        const shot = await bridge.invoke("take_photo");
        await loadPhotoFromBytesBase64(shot.bytesBase64, shot.mime);
        return;
      } catch (e) {
        setStatus(formatNativeError(e));
      } finally {
        setBusy(false);
      }
    }
    ui.cameraInput.click();
  });

  ui.fileInput.addEventListener("change", async () => {
    const file = ui.fileInput.files?.[0];
    ui.fileInput.value = "";
    if (!file) return;
    await loadPhoto(file);
  });
  ui.cameraInput.addEventListener("change", async () => {
    const file = ui.cameraInput.files?.[0];
    ui.cameraInput.value = "";
    if (!file) return;
    await loadPhoto(file);
  });

  ui.selectEngine.addEventListener("change", () => {
    state.settings.engine = ui.selectEngine.value;
    persistSettings();
  });
  if (ui.selectTheme) {
    ui.selectTheme.addEventListener("change", () => {
      state.settings.theme = ui.selectTheme.value;
      persistSettings();
      applyTheme();
    });
  }
  if (ui.selectUiLang) {
    ui.selectUiLang.addEventListener("change", () => {
      state.settings.uiLang = ui.selectUiLang.value;
      persistSettings();
      applyLanguage();
      updateSettingsControls();
    });
  }
  ui.selectLang.addEventListener("change", () => {
    state.settings.lang = ui.selectLang.value;
    persistSettings();
  });
  ui.toggleAutoCorrect.addEventListener("click", () => {
    state.settings.autoCorrect = !state.settings.autoCorrect;
    ui.toggleAutoCorrect.textContent = state.settings.autoCorrect ? t("common.on") : t("common.off");
    persistSettings();
  });
  ui.toggleAiClean.addEventListener("click", () => {
    state.settings.aiClean = !state.settings.aiClean;
    ui.toggleAiClean.textContent = state.settings.aiClean ? t("common.on") : t("common.off");
    persistSettings();
  });
  if (ui.inputAiPrompt) {
    ui.inputAiPrompt.addEventListener("change", () => {
      state.settings.aiPrompt = ui.inputAiPrompt.value;
      persistSettings();
    });
  }
  ui.inputModelPath.addEventListener("change", () => {
    state.settings.modelPath = ui.inputModelPath.value.trim();
    persistSettings();
    warmupGemmaInBackground();
  });
  if (ui.inputModelUrl) {
    ui.inputModelUrl.addEventListener("change", () => {
      state.settings.modelUrl = ui.inputModelUrl.value.trim();
      persistSettings();
    });
  }
  if (ui.btnDownloadModel) {
    ui.btnDownloadModel.addEventListener("click", downloadModel);
  }
  if (ui.btnDownloadE2B) {
    ui.btnDownloadE2B.addEventListener("click", async () => {
      await downloadGemmaPreset("e2b");
    });
  }
  if (ui.btnDownloadE4B) {
    ui.btnDownloadE4B.addEventListener("click", async () => {
      await downloadGemmaPreset("e4b");
    });
  }

  ui.btnToggleWarp.addEventListener("click", toggleWarpMode);
  ui.btnApplyWarp.addEventListener("click", applyWarp);
  if (ui.btnRotateLeft) ui.btnRotateLeft.addEventListener("click", () => rotateWorkingImage("left"));
  if (ui.btnRotateRight) ui.btnRotateRight.addEventListener("click", () => rotateWorkingImage("right"));
  ui.btnRecognize.addEventListener("click", recognize);

  ui.btnToggleTextSettings.addEventListener("click", () => {
    ui.textSettings.classList.toggle("settings--hidden");
  });
  ui.btnClean.addEventListener("click", cleanWithGemma);

  ui.fontFamily.addEventListener("change", () => {
    state.readingStyle.fontFamily = ui.fontFamily.value;
    persistSettings();
    applyReadingStyle();
  });
  ui.fontSize.addEventListener("change", () => {
    const v = Number(ui.fontSize.value);
    if (Number.isFinite(v) && v >= 12 && v <= 96) {
      state.readingStyle.fontSizePx = v;
      persistSettings();
      applyReadingStyle();
    }
  });
  ui.lineHeight.addEventListener("change", () => {
    const v = Number(ui.lineHeight.value);
    if (Number.isFinite(v) && v >= 1.1 && v <= 3.0) {
      state.readingStyle.lineHeight = v;
      persistSettings();
      applyReadingStyle();
    }
  });
  ui.bgColor.addEventListener("change", () => {
    state.readingStyle.background = ui.bgColor.value;
    persistSettings();
    applyReadingStyle();
  });
  ui.textColor.addEventListener("change", () => {
    state.readingStyle.textColor = ui.textColor.value;
    persistSettings();
    applyReadingStyle();
  });
}

tryLoadSettings();
applyTheme();
applyLanguage();
updateSettingsControls();
applyReadingStyle();
setupModelDownloadListener();
installOverlayInteractions();
wireUi();
showScreen("home", { push: false });
setStatus(t("status.ready"));
warmupGemmaInBackground();

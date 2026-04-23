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

function setStatus(text) {
  ui.statusText.textContent = text;
}

function setBusy(isBusy, text) {
  if (!ui.busyOverlay) return;
  if (isBusy) {
    if (ui.busyText) ui.busyText.textContent = text || "Обробка…";
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
  setStatus("Підготовка нейромережі…");
  setBusy(true, "Підготовка нейромережі…");
  try {
    await bridge.invoke("ensure_litert_lm");
    return true;
  } catch (e) {
    setStatus(String(e?.message || e || "Не вдалося підготувати нейромережу"));
    return false;
  } finally {
    setBusy(false);
  }
}

function showScreen(name, { push = true } = {}) {
  for (const k of Object.keys(ui.screens)) ui.screens[k].classList.remove("screen--active");
  ui.screens[name].classList.add("screen--active");
  if (push) state.nav.push(name);
  ui.btnBack.style.visibility = state.nav.length > 1 ? "visible" : "hidden";
  ui.btnGoSettings.style.visibility = name === "settings" ? "hidden" : "visible";
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

function updateSettingsControls() {
  ui.selectEngine.value = state.settings.engine;
  ui.selectLang.value = state.settings.lang;
  ui.toggleAutoCorrect.textContent = state.settings.autoCorrect ? "Увімкнено" : "Вимкнено";
  ui.toggleAiClean.textContent = state.settings.aiClean ? "Увімкнено" : "Вимкнено";
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
      if (ui.busyText) ui.busyText.textContent = `Завантаження моделі… ${label}`;
    }
  });
}

async function downloadModel({ urlOverride = null, filenameOverride = null } = {}) {
  const bridge = getBridge();
  if (!bridge) {
    setStatus("Немає нативного мосту (запустіть як Tauri застосунок)");
    return;
  }
  const url = (urlOverride || ui.inputModelUrl?.value || "").trim();
  if (!url) {
    setStatus("Вкажіть посилання на модель");
    return;
  }

  setModelDownloadStatus("");
  setStatus("Завантаження моделі…");
  setBusy(true, "Завантаження моделі…");
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
      setModelDownloadStatus("Готово");
      setStatus("Модель завантажено");
    } else {
      setStatus("Не вдалося отримати шлях до моделі");
    }
  } catch (e) {
    setStatus(String(e?.message || e));
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
    ui.imgPreview.onerror = () => reject(new Error("Не вдалося показати зображення"));
  });
  ui.imgPreview.style.display = "block";
}

async function loadPhotoFromBytesBase64(bytesBase64, mime = "image/jpeg") {
  setStatus("Завантаження фото…");
  setBusy(true, "Завантаження фото…");
  state.roi = null;
  updateRoiText();
  clearRoiBox();
  hideHandlesAndQuad();
  state.mode = "roi";
  ui.btnToggleWarp.textContent = "Корекція перспективи";
  ui.btnApplyWarp.style.display = "none";
  ui.btnRecognize.disabled = false;

  state.originalImage = { bytesBase64, mime: mime || "image/jpeg" };
  state.workingImage = { bytesBase64, mime: mime || "image/jpeg" };

  ui.imgPreview.src = base64ToDataUrl(bytesBase64, mime || "image/jpeg");
  await new Promise((resolve, reject) => {
    ui.imgPreview.onload = () => resolve();
    ui.imgPreview.onerror = () => reject(new Error("Не вдалося показати зображення"));
  });
  ui.imgPreview.style.display = "block";
  setBusy(false);

  resetQuadToCorners();
  showScreen("edit");
  setStatus("Виділіть область або виправте перспективу");
}

async function loadPhoto(file) {
  setStatus("Завантаження фото…");
  setBusy(true, "Завантаження фото…");
  state.roi = null;
  updateRoiText();
  clearRoiBox();
  hideHandlesAndQuad();
  state.mode = "roi";
  ui.btnToggleWarp.textContent = "Корекція перспективи";
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
  setStatus("Виділіть область або виправте перспективу");
}

async function rotateWorkingImage(direction) {
  const bridge = getBridge();
  if (!bridge) {
    setStatus("Немає нативного мосту (запустіть як Tauri застосунок)");
    return;
  }
  if (!state.workingImage) return;
  setStatus("Поворот…");
  setBusy(true, "Поворот…");
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
    ui.btnToggleWarp.textContent = "Корекція перспективи";
    ui.btnApplyWarp.style.display = "none";
    ui.btnRecognize.disabled = false;
    resetQuadToCorners();
    setStatus("Готово");
  } catch (e) {
    setStatus(String(e?.message || e || "Не вдалося повернути зображення"));
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
  ui.btnToggleWarp.textContent = "Застосувати";
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
    setStatus("Немає фото");
    return;
  }
  const bridge = getBridge();
  if (!bridge) {
    setStatus("Немає нативного мосту (запустіть як Tauri застосунок)");
    return;
  }

  setStatus("Корекція перспективи…");
  setBusy(true, "Корекція перспективи…");
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
    ui.btnToggleWarp.textContent = "Корекція перспективи";
    ui.btnApplyWarp.style.display = "none";
    ui.btnRecognize.disabled = false;
    hideHandlesAndQuad();
    setStatus("Готово. Виділіть область тексту");
  } catch (e) {
    setStatus(String(e?.message || e));
  } finally {
    setBusy(false);
    ui.btnApplyWarp.disabled = false;
    ui.btnToggleWarp.disabled = false;
    ui.btnRecognize.disabled = false;
  }
}

async function recognize() {
  if (!state.workingImage) {
    setStatus("Спочатку оберіть фото");
    return;
  }

  setStatus("Розпізнавання…");
  setBusy(true, "Розпізнавання…");
  await new Promise((resolve) => requestAnimationFrame(() => resolve()));

  if (!state.roi) {
    const nw = ui.imgPreview.naturalWidth || 0;
    const nh = ui.imgPreview.naturalHeight || 0;
    if (nw && nh) {
      state.roi = { x: 0, y: 0, w: nw, h: nh };
      updateRoiText();
      setStatus("Область не вибрано — розпізнаю все фото");
    } else {
      setStatus("Спочатку виділіть область");
      setBusy(false);
      return;
    }
  }

  const bridge = getBridge();
  if (!bridge) {
    setStatus("Немає нативного мосту (запустіть як Tauri застосунок)");
    setBusy(false);
    return;
  }

  ui.btnRecognize.disabled = true;

  try {
    const engineToUse = state.settings.engine;
    const modelPath = state.settings.modelPath?.trim() || "";
    if (engineToUse === "gemma") {
      if (!modelPath) {
        setStatus("Для Gemma OCR вкажіть шлях до моделі в налаштуваннях");
        return;
      }
      setStatus("Підготовка Gemma OCR…");
      setBusy(true, "Підготовка Gemma OCR…");
      await new Promise((resolve) => requestAnimationFrame(() => resolve()));
      await bridge.invoke("ensure_gemma_ocr_runtime");
      setStatus("Розпізнавання (Gemma)…");
      setBusy(true, "Розпізнавання (Gemma)…");
      await new Promise((resolve) => requestAnimationFrame(() => resolve()));
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
      setStatus("Нульовий результат. Спробуйте іншу область або мову OCR.");
      return;
    }
    setOutputText(state.rawText);
    ui.textSettings.classList.add("settings--hidden");
    showScreen("result");

    const shouldClean = state.settings.aiClean || engineToUse === "gemma";
    if (shouldClean) {
      const ok = await ensureLiteRtLm(bridge);
      if (!ok) return;
      setStatus("Очищення…");
      setBusy(true, "Очищення…");
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
        setStatus("Готово");
      } catch (e) {
        const msg = String(e?.message || e || "");
        setStatus(`OCR готово. Очищення не вдалося: ${msg}`);
      }
    } else {
      setStatus("Готово");
    }
  } catch (e) {
    setStatus(String(e?.message || e));
  } finally {
    setBusy(false);
    ui.btnRecognize.disabled = false;
  }
}

async function cleanWithGemma() {
  const bridge = getBridge();
  if (!bridge) {
    setStatus("Немає нативного мосту (запустіть як Tauri застосунок)");
    return;
  }
  if (!state.rawText.trim()) {
    setStatus("Немає тексту для очищення");
    return;
  }

  setStatus("Очищення…");
  setBusy(true, "Очищення…");
  ui.btnClean.disabled = true;

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
    setStatus("Готово");
  } catch (e) {
    const msg = String(e?.message || e || "");
    setStatus(msg);
  } finally {
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
      setStatus("Відкриваю камеру…");
      setBusy(true, "Відкриваю камеру…");
      try {
        const shot = await bridge.invoke("take_photo");
        await loadPhotoFromBytesBase64(shot.bytesBase64, shot.mime);
        return;
      } catch (e) {
        setStatus(String(e?.message || e || "Не вдалося відкрити камеру"))
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
  ui.selectLang.addEventListener("change", () => {
    state.settings.lang = ui.selectLang.value;
    persistSettings();
  });
  ui.toggleAutoCorrect.addEventListener("click", () => {
    state.settings.autoCorrect = !state.settings.autoCorrect;
    ui.toggleAutoCorrect.textContent = state.settings.autoCorrect ? "Увімкнено" : "Вимкнено";
    persistSettings();
  });
  ui.toggleAiClean.addEventListener("click", () => {
    state.settings.aiClean = !state.settings.aiClean;
    ui.toggleAiClean.textContent = state.settings.aiClean ? "Увімкнено" : "Вимкнено";
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
updateSettingsControls();
applyReadingStyle();
setupModelDownloadListener();
installOverlayInteractions();
wireUi();
showScreen("home", { push: false });
setStatus("Готово");
warmupGemmaInBackground();

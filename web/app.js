import { bindControlEvents, syncControlsFromState } from "./modules/controls.js";
import { builtInPresets, initialState } from "./modules/defaults.js";
import { loadImageFromFile } from "./modules/image-loader.js";
import { createPlaceholderImage, isPlaceholderImage } from "./modules/placeholder.js";
import {
  createPresetExportData,
  deleteUserPreset,
  getPresetOptions,
  importUserPresets,
  saveUserPreset,
} from "./modules/presets.js";
import { getTailDragValues, getTailHandlePoint, renderScene } from "./modules/renderer.js";

const state = { ...initialState };
let image = createPlaceholderImage();
let sourceFileBaseName = "3d-rotated-image";
let presets = [];

const canvas = document.querySelector("#canvas");
const stageCard = document.querySelector("#stageCard");
const previewThemeButton = document.querySelector("#previewThemeButton");
const imageInput = document.querySelector("#imageInput");
const imageStatus = document.querySelector("#imageStatus");
const downloadButton = document.querySelector("#downloadButton");
const resetAllButton = document.querySelector("#resetAllButton");
const mobileDownloadButton = document.querySelector("#mobileDownloadButton");
const mobileResetButton = document.querySelector("#mobileResetButton");
const resetTransformButton = document.querySelector("#resetTransformButton");
const resetShadowButton = document.querySelector("#resetShadowButton");
const resetTailButton = document.querySelector("#resetTailButton");
const presetSelect = document.querySelector("#presetSelect");
const savePresetButton = document.querySelector("#savePresetButton");
const deletePresetButton = document.querySelector("#deletePresetButton");
const exportPresetsButton = document.querySelector("#exportPresetsButton");
const importPresetsButton = document.querySelector("#importPresetsButton");
const presetImportInput = document.querySelector("#presetImportInput");
const presetDialog = document.querySelector("#presetDialog");
const presetDialogForm = presetDialog.querySelector("form");
const resetConfirmDialog = document.querySelector("#resetConfirmDialog");
const cancelResetButton = document.querySelector("#cancelResetButton");
const confirmResetButton = document.querySelector("#confirmResetButton");
const presetNameInput = document.querySelector("#presetNameInput");
const presetNameError = document.querySelector("#presetNameError");
const cancelPresetSaveButton = document.querySelector("#cancelPresetSaveButton");
const controls = [...document.querySelectorAll("[data-control]")];
const mobileTabButtons = [...document.querySelectorAll("[data-mobile-tab]")];
const mobilePanels = [...document.querySelectorAll("[data-mobile-panel]")];
const toast = document.querySelector("#toast");
const toastText = toast?.querySelector(".toast__text");
const transformKeys = ["rotateX", "rotateY", "rotateZ", "perspective", "scale"];
const shadowKeys = [
  "shadowEnabled",
  "shadowAlpha",
  "shadowBlur",
  "shadowX",
  "shadowY",
  "shadowSkew",
];
const tailKeys = ["tailSide", "tailPosition", "tailWidth", "tailLength", "tailLean", "tailColor"];
const EXPORT_ALPHA_THRESHOLD = 4;
const EXPORT_PADDING = 96;
const canvasProfiles = {
  desktop: { width: 2160, height: 3840 },
  mobile: { width: 1080, height: 1920 },
};
const mobileRenderQuery = window.matchMedia("(max-width: 720px), (pointer: coarse)");
const mobileUiQuery = window.matchMedia("(max-width: 720px), (pointer: coarse)");
const previewThemes = ["light", "checker", "dark"];
const previewThemeLabels = {
  light: "밝은 배경",
  checker: "체크보드",
  dark: "어두운 배경",
};
const TAIL_HANDLE_HIT_RADIUS = window.matchMedia("(pointer: coarse)").matches ? 34 : 22;
let isDraggingTailHandle = false;
let suppressCanvasImagePickerClick = false;
let pendingRenderId = null;
let toastTimerId = null;
let presetDialogReturnFocusElement = null;
let resetDialogReturnFocusElement = null;

function hapticLight() {
  if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
    navigator.vibrate(12);
  }
}

function syncMobileDetailsMode() {
  const groups = [...document.querySelectorAll("details.control-group")];

  if (!groups.length) {
    return;
  }

  if (mobileUiQuery.matches) {
    for (const group of groups) {
      group.open = true;
    }
  }
}

function syncCanvasResolution() {
  const nextProfile = mobileRenderQuery.matches ? canvasProfiles.mobile : canvasProfiles.desktop;

  if (canvas.width === nextProfile.width && canvas.height === nextProfile.height) {
    return false;
  }

  canvas.width = nextProfile.width;
  canvas.height = nextProfile.height;
  canvas.dataset.renderProfile = mobileRenderQuery.matches ? "mobile" : "desktop";

  return true;
}

function syncPreviewAccessibility() {
  const placeholder = isPlaceholderImage(image);
  canvas.classList.toggle("is-placeholder-preview", placeholder);
  canvas.setAttribute(
    "aria-label",
    placeholder ? "미리보기 — 탭하면 사진을 선택합니다" : "편집 미리보기",
  );
}

function render() {
  pendingRenderId = null;
  syncCanvasResolution();
  stageCard.dataset.previewTheme = state.previewTheme;
  previewThemeButton.dataset.previewTheme = state.previewTheme;
  previewThemeButton.title = `미리보기 배경: ${previewThemeLabels[state.previewTheme]}`;
  previewThemeButton.setAttribute("aria-label", previewThemeButton.title);
  syncPreviewAccessibility();
  renderScene(canvas, image, state);
}

function scheduleRender() {
  if (pendingRenderId !== null) {
    return;
  }

  pendingRenderId = window.requestAnimationFrame(render);
}

function copyStateValues(source) {
  return JSON.parse(JSON.stringify(source));
}

function normalizeStateValues(source) {
  const normalizedState = { ...source };

  if ("tiltHorizontal" in normalizedState && !("rotateY" in normalizedState)) {
    normalizedState.rotateY = normalizedState.tiltHorizontal;
  }

  if ("tiltVertical" in normalizedState && !("rotateX" in normalizedState)) {
    normalizedState.rotateX = normalizedState.tiltVertical;
  }

  delete normalizedState.tiltHorizontal;
  delete normalizedState.tiltVertical;

  if (!["top", "right", "bottom", "left"].includes(normalizedState.tailSide)) {
    normalizedState.tailSide = initialState.tailSide;
  }

  delete normalizedState.fitToCanvas;

  return normalizedState;
}

function syncTailColorHexField() {
  const tailColorHexInput = document.querySelector("#tailColorHex");

  if (!tailColorHexInput) {
    return;
  }

  tailColorHexInput.value = String(state.tailColor || "#ffffff").toUpperCase();
}

function applyState(nextState) {
  Object.assign(state, normalizeStateValues(nextState));
  syncControlsFromState(controls, state);
  syncTailColorHexField();
  render();
}

function resetKeys(keys) {
  for (const key of keys) {
    state[key] = initialState[key];
  }

  syncControlsFromState(controls, state);
  syncTailColorHexField();
  render();
}

function resetAllControls() {
  const currentTailEnabled = state.tailEnabled;
  applyState({ ...initialState, tailEnabled: currentTailEnabled });
}

function showToast(message, options = {}) {
  if (!toast || !toastText) {
    return;
  }

  const { variant } = options;
  toast.classList.toggle("toast--success", variant === "success");
  toastText.textContent = message;
  toast.classList.add("is-visible");
  window.clearTimeout(toastTimerId);
  toastTimerId = window.setTimeout(() => {
    toast.classList.remove("is-visible", "toast--success");
  }, 2000);
}

function getCanvasPoint(event) {
  const rect = canvas.getBoundingClientRect();

  return {
    x: ((event.clientX - rect.left) / rect.width) * canvas.width,
    y: ((event.clientY - rect.top) / rect.height) * canvas.height,
  };
}

function getCanvasScale() {
  return canvas.width / canvas.getBoundingClientRect().width;
}

function getClampedControlValue(key, value) {
  const control = controls.find((item) => item.dataset.control === key);

  if (!control || control.type === "checkbox" || control.type === "color") {
    return value;
  }

  const min = Number(control.min);
  const max = Number(control.max);

  return Math.min(max, Math.max(min, Math.round(value)));
}

function applyTailDragValues(canvasPoint) {
  const nextValues = getTailDragValues(canvas, image, state, canvasPoint);

  if (!nextValues) {
    return;
  }

  state.tailLean = getClampedControlValue("tailLean", nextValues.tailLean);
  state.tailLength = getClampedControlValue("tailLength", nextValues.tailLength);
  syncControlsFromState(controls, state);
  scheduleRender();
}

function refreshPresetOptions(selectedId = presetSelect.value) {
  presets = getPresetOptions(builtInPresets);
  presetSelect.innerHTML = "";

  for (const preset of presets) {
    const option = document.createElement("option");
    option.value = preset.id;
    option.textContent = preset.removable ? `${preset.name} *` : preset.name;
    presetSelect.append(option);
  }

  if (presets.some((preset) => preset.id === selectedId)) {
    presetSelect.value = selectedId;
  }
}

function getNextPresetName() {
  const userPresetCount = presets.filter((preset) => preset.removable).length;

  return `내 프리셋 ${userPresetCount + 1}`;
}

function getContentBounds(sourceCanvas) {
  const context = sourceCanvas.getContext("2d");
  const { width, height } = sourceCanvas;
  const pixels = context.getImageData(0, 0, width, height).data;
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const alpha = pixels[(y * width + x) * 4 + 3];

      if (alpha > EXPORT_ALPHA_THRESHOLD) {
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }
  }

  if (maxX < 0 || maxY < 0) {
    return null;
  }

  const x = Math.max(0, minX - EXPORT_PADDING);
  const y = Math.max(0, minY - EXPORT_PADDING);
  const right = Math.min(width, maxX + EXPORT_PADDING + 1);
  const bottom = Math.min(height, maxY + EXPORT_PADDING + 1);

  return {
    x,
    y,
    width: right - x,
    height: bottom - y,
  };
}

function createSmartExportCanvas(sourceCanvas) {
  const bounds = getContentBounds(sourceCanvas);

  if (!bounds) {
    return sourceCanvas;
  }

  const exportCanvas = document.createElement("canvas");
  exportCanvas.width = bounds.width;
  exportCanvas.height = bounds.height;
  exportCanvas
    .getContext("2d")
    .drawImage(
      sourceCanvas,
      bounds.x,
      bounds.y,
      bounds.width,
      bounds.height,
      0,
      0,
      bounds.width,
      bounds.height,
    );

  return exportCanvas;
}

function createHighResolutionExportSource() {
  const exportSource = document.createElement("canvas");
  exportSource.width = canvasProfiles.desktop.width;
  exportSource.height = canvasProfiles.desktop.height;
  renderScene(exportSource, image, state, { showTailHandle: false });

  return exportSource;
}

function getFileBaseName(fileName) {
  const lastDotIndex = fileName.lastIndexOf(".");
  const baseName = lastDotIndex > 0 ? fileName.slice(0, lastDotIndex) : fileName;
  const safeName = baseName.trim().replace(/[<>:"/\\|?*\u0000-\u001f]/g, "_");

  return safeName || "3d-rotated-image";
}

function setLoadedImageStatus(file) {
  if (imageStatus) {
    imageStatus.textContent = file.name;
    imageStatus.title = file.name;
  }
}

function downloadJsonFile(fileName, data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.download = fileName;
  link.href = url;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

async function loadSelectedImage() {
  const file = imageInput.files?.[0];

  if (!file) {
    return;
  }

  try {
    image = await loadImageFromFile(file);
    sourceFileBaseName = getFileBaseName(file.name);
    setLoadedImageStatus(file);
    render();
    hapticLight();
    showToast("이미지를 불러왔습니다.", { variant: "success" });
  } catch (error) {
    window.alert(error.message);
  }
}

function downloadPng() {
  const exportCanvas = createSmartExportCanvas(createHighResolutionExportSource());
  const link = document.createElement("a");
  link.download = `${sourceFileBaseName}_3D.png`;
  link.href = exportCanvas.toDataURL("image/png");
  link.click();
  hapticLight();
  showToast("PNG 저장을 시작했습니다.", { variant: "success" });
}

function performResetAll() {
  resetAllControls();
  hapticLight();
  showToast("설정을 기본값으로 되돌렸습니다.");
}

function openResetConfirmDialog() {
  resetDialogReturnFocusElement = document.activeElement;
  resetConfirmDialog.hidden = false;
  cancelResetButton.focus();
}

function closeResetConfirmDialog() {
  resetConfirmDialog.hidden = true;
  resetDialogReturnFocusElement?.focus();
  resetDialogReturnFocusElement = null;
}

function showMobilePanel(panelName) {
  for (const button of mobileTabButtons) {
    button.setAttribute("aria-pressed", String(button.dataset.mobileTab === panelName));
  }

  for (const panel of mobilePanels) {
    const isActivePanel = panel.dataset.mobilePanel === panelName;
    panel.dataset.mobileActive = String(isActivePanel);

    if (isActivePanel && panel instanceof HTMLDetailsElement) {
      panel.open = true;
    }
  }
}

function closePresetDialog() {
  presetDialog.hidden = true;
  presetNameError.textContent = "";
  presetDialogReturnFocusElement?.focus();
  presetDialogReturnFocusElement = null;
}

function openPresetDialog() {
  presetDialogReturnFocusElement = document.activeElement;
  presetNameInput.value = getNextPresetName();
  presetNameError.textContent = "";
  presetDialog.hidden = false;
  presetNameInput.focus();
  presetNameInput.select();
}

function saveCurrentPreset(name) {
  saveUserPreset(name, copyStateValues(state));
  refreshPresetOptions();
  presetSelect.value = presets.at(-1).id;
  showToast("현재 설정을 프리셋으로 저장했습니다.", { variant: "success" });
}

imageInput.addEventListener("change", loadSelectedImage);

canvas.addEventListener("click", (event) => {
  if (suppressCanvasImagePickerClick) {
    suppressCanvasImagePickerClick = false;
    return;
  }

  if (!isPlaceholderImage(image)) {
    return;
  }

  const handlePoint = getTailHandlePoint(canvas, image, state);

  if (handlePoint) {
    const canvasPoint = getCanvasPoint(event);
    const hitRadius = TAIL_HANDLE_HIT_RADIUS * getCanvasScale();

    if (Math.hypot(canvasPoint.x - handlePoint.x, canvasPoint.y - handlePoint.y) <= hitRadius) {
      return;
    }
  }

  imageInput.click();
});

canvas.addEventListener("pointerdown", (event) => {
  const handlePoint = getTailHandlePoint(canvas, image, state);

  if (!handlePoint) {
    return;
  }

  const canvasPoint = getCanvasPoint(event);
  const hitRadius = TAIL_HANDLE_HIT_RADIUS * getCanvasScale();

  if (Math.hypot(canvasPoint.x - handlePoint.x, canvasPoint.y - handlePoint.y) > hitRadius) {
    return;
  }

  isDraggingTailHandle = true;
  event.preventDefault();
  canvas.classList.add("is-dragging-tail");
  canvas.setPointerCapture(event.pointerId);
  applyTailDragValues(canvasPoint);
});

canvas.addEventListener("pointermove", (event) => {
  if (!isDraggingTailHandle) {
    return;
  }

  event.preventDefault();
  applyTailDragValues(getCanvasPoint(event));
});

canvas.addEventListener("pointerup", (event) => {
  if (!isDraggingTailHandle) {
    return;
  }

  isDraggingTailHandle = false;
  suppressCanvasImagePickerClick = true;
  canvas.classList.remove("is-dragging-tail");
  canvas.releasePointerCapture(event.pointerId);
});

canvas.addEventListener("pointercancel", (event) => {
  if (isDraggingTailHandle) {
    suppressCanvasImagePickerClick = true;
  }
  isDraggingTailHandle = false;
  canvas.classList.remove("is-dragging-tail");

  if (canvas.hasPointerCapture(event.pointerId)) {
    canvas.releasePointerCapture(event.pointerId);
  }
});

bindControlEvents(controls, state, initialState, scheduleRender);

const tailColorInput = document.querySelector("#tailColor");
const tailColorHexInput = document.querySelector("#tailColorHex");

function normalizeTailColorHex(raw) {
  let value = raw.trim();

  if (!value.startsWith("#")) {
    value = `#${value}`;
  }

  return /^#[0-9A-Fa-f]{6}$/.test(value) ? value.toLowerCase() : null;
}

if (tailColorHexInput) {
  tailColorHexInput.addEventListener("change", () => {
    const hex = normalizeTailColorHex(tailColorHexInput.value);

    if (hex) {
      state.tailColor = hex;

      if (tailColorInput) {
        tailColorInput.value = hex;
      }

      scheduleRender();
    } else {
      syncTailColorHexField();
    }
  });

  tailColorHexInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      tailColorHexInput.blur();
    }
  });
}

if (tailColorInput) {
  tailColorInput.addEventListener("input", () => {
    syncTailColorHexField();
  });

  tailColorInput.addEventListener("dblclick", () => {
    syncTailColorHexField();
  });
}

for (const summary of document.querySelectorAll("details.control-group > summary")) {
  summary.addEventListener("click", (event) => {
    if (!mobileUiQuery.matches) {
      return;
    }

    event.preventDefault();
  });
}

presetSelect.addEventListener("change", () => {
  const selectedPreset = presets.find((preset) => preset.id === presetSelect.value);

  if (selectedPreset) {
    applyState(copyStateValues(selectedPreset.values));
  }
});

savePresetButton.addEventListener("click", openPresetDialog);

presetDialogForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const name = presetNameInput.value.trim();

  if (!name) {
    presetNameError.textContent = "프리셋 이름을 입력하세요.";
    presetNameInput.focus();
    return;
  }

  saveCurrentPreset(name);
  hapticLight();
  closePresetDialog();
});

cancelPresetSaveButton.addEventListener("click", closePresetDialog);

presetDialog.addEventListener("click", (event) => {
  if (event.target === presetDialog) {
    closePresetDialog();
  }
});

resetConfirmDialog.addEventListener("click", (event) => {
  if (event.target === resetConfirmDialog) {
    closeResetConfirmDialog();
  }
});

cancelResetButton.addEventListener("click", () => {
  closeResetConfirmDialog();
});

confirmResetButton.addEventListener("click", () => {
  closeResetConfirmDialog();
  performResetAll();
});

window.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") {
    return;
  }

  if (!resetConfirmDialog.hidden) {
    closeResetConfirmDialog();
    return;
  }

  if (!presetDialog.hidden) {
    closePresetDialog();
  }
});

deletePresetButton.addEventListener("click", () => {
  const selectedPreset = presets.find((preset) => preset.id === presetSelect.value);

  if (!selectedPreset?.removable) {
    window.alert("기본 프리셋은 삭제할 수 없습니다.");
    return;
  }

  deleteUserPreset(Number(selectedPreset.id.replace("user:", "")));
  refreshPresetOptions("built-in:0");
});

exportPresetsButton.addEventListener("click", () => {
  downloadJsonFile("3d-rotator-presets.json", createPresetExportData());
});

importPresetsButton.addEventListener("click", () => {
  presetImportInput.click();
});

presetImportInput.addEventListener("change", async () => {
  const file = presetImportInput.files?.[0];

  if (!file) {
    return;
  }

  try {
    const importedCount = importUserPresets(JSON.parse(await file.text()));
    refreshPresetOptions();
    window.alert(`${importedCount}개의 프리셋을 불러왔습니다.`);
  } catch (error) {
    window.alert(error.message);
  } finally {
    presetImportInput.value = "";
  }
});

previewThemeButton.addEventListener("click", () => {
  const currentIndex = previewThemes.indexOf(state.previewTheme);
  state.previewTheme = previewThemes[(currentIndex + 1) % previewThemes.length];
  render();
});

downloadButton.addEventListener("click", () => {
  downloadPng();
});

mobileDownloadButton.addEventListener("click", downloadPng);
mobileResetButton.addEventListener("click", openResetConfirmDialog);
resetAllButton.addEventListener("click", openResetConfirmDialog);
resetTransformButton.addEventListener("click", () => resetKeys(transformKeys));
resetShadowButton.addEventListener("click", () => resetKeys(shadowKeys));
resetTailButton.addEventListener("click", () => resetKeys(tailKeys));
for (const button of mobileTabButtons) {
  button.addEventListener("click", () => showMobilePanel(button.dataset.mobileTab));
}
mobileRenderQuery.addEventListener("change", render);
mobileUiQuery.addEventListener("change", syncMobileDetailsMode);
window.addEventListener("resize", () => {
  if (syncCanvasResolution()) {
    render();
  }
});

refreshPresetOptions("built-in:0");
showMobilePanel("transform");
syncControlsFromState(controls, state);
syncTailColorHexField();
syncMobileDetailsMode();
render();

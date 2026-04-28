import { bindControlEvents, syncControlsFromState } from "./modules/controls.js";
import { builtInPresets, initialState } from "./modules/defaults.js";
import { loadImageFromFile } from "./modules/image-loader.js";
import { createPlaceholderImage } from "./modules/placeholder.js";
import { deleteUserPreset, getPresetOptions, saveUserPreset } from "./modules/presets.js";
import { getTailDragValues, getTailHandlePoint, renderScene } from "./modules/renderer.js";

const state = { ...initialState };
let image = createPlaceholderImage();
let sourceFileBaseName = "3d-rotated-image";
let presets = [];

const canvas = document.querySelector("#canvas");
const stageCard = document.querySelector("#stageCard");
const imageInput = document.querySelector("#imageInput");
const downloadButton = document.querySelector("#downloadButton");
const resetAllButton = document.querySelector("#resetAllButton");
const resetTransformButton = document.querySelector("#resetTransformButton");
const resetShadowButton = document.querySelector("#resetShadowButton");
const resetTailButton = document.querySelector("#resetTailButton");
const presetSelect = document.querySelector("#presetSelect");
const savePresetButton = document.querySelector("#savePresetButton");
const deletePresetButton = document.querySelector("#deletePresetButton");
const controls = [...document.querySelectorAll("[data-control]")];
const transformKeys = [
  "rotateX",
  "rotateY",
  "rotateZ",
  "perspective",
  "scale",
  "fitToCanvas",
];
const shadowKeys = [
  "shadowEnabled",
  "shadowAlpha",
  "shadowBlur",
  "shadowX",
  "shadowY",
  "shadowSkew",
];
const tailKeys = ["tailPosition", "tailWidth", "tailLength", "tailLean", "tailColor"];
const EXPORT_ALPHA_THRESHOLD = 4;
const EXPORT_PADDING = 96;
const TAIL_HANDLE_HIT_RADIUS = 22;
let isDraggingTailHandle = false;

function render() {
  stageCard.dataset.previewTheme = state.previewTheme;
  renderScene(canvas, image, state);
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

  return normalizedState;
}

function applyState(nextState) {
  Object.assign(state, normalizeStateValues(nextState));
  syncControlsFromState(controls, state);
  render();
}

function resetKeys(keys) {
  for (const key of keys) {
    state[key] = initialState[key];
  }

  syncControlsFromState(controls, state);
  render();
}

function resetAllControls() {
  const currentTailEnabled = state.tailEnabled;
  applyState({ ...initialState, tailEnabled: currentTailEnabled });
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
  render();
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

function getFileBaseName(fileName) {
  const lastDotIndex = fileName.lastIndexOf(".");
  const baseName = lastDotIndex > 0 ? fileName.slice(0, lastDotIndex) : fileName;
  const safeName = baseName.trim().replace(/[<>:"/\\|?*\u0000-\u001f]/g, "_");

  return safeName || "3d-rotated-image";
}

imageInput.addEventListener("change", async () => {
  const file = imageInput.files?.[0];

  if (!file) {
    return;
  }

  try {
    image = await loadImageFromFile(file);
    sourceFileBaseName = getFileBaseName(file.name);
    render();
  } catch (error) {
    window.alert(error.message);
  }
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
  canvas.setPointerCapture(event.pointerId);
  applyTailDragValues(canvasPoint);
});

canvas.addEventListener("pointermove", (event) => {
  if (!isDraggingTailHandle) {
    return;
  }

  applyTailDragValues(getCanvasPoint(event));
});

canvas.addEventListener("pointerup", (event) => {
  if (!isDraggingTailHandle) {
    return;
  }

  isDraggingTailHandle = false;
  canvas.releasePointerCapture(event.pointerId);
});

canvas.addEventListener("pointercancel", (event) => {
  isDraggingTailHandle = false;

  if (canvas.hasPointerCapture(event.pointerId)) {
    canvas.releasePointerCapture(event.pointerId);
  }
});

bindControlEvents(controls, state, initialState, render);

presetSelect.addEventListener("change", () => {
  const selectedPreset = presets.find((preset) => preset.id === presetSelect.value);

  if (selectedPreset) {
    applyState(copyStateValues(selectedPreset.values));
  }
});

savePresetButton.addEventListener("click", () => {
  const name = window.prompt("저장할 프리셋 이름을 입력하세요.");

  if (!name?.trim()) {
    return;
  }

  saveUserPreset(name.trim(), copyStateValues(state));
  refreshPresetOptions();
  presetSelect.value = presets.at(-1).id;
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

downloadButton.addEventListener("click", () => {
  renderScene(canvas, image, state, { showTailHandle: false });
  const exportCanvas = createSmartExportCanvas(canvas);
  const link = document.createElement("a");
  link.download = `${sourceFileBaseName}_3D.png`;
  link.href = exportCanvas.toDataURL("image/png");
  link.click();
  render();
});

resetAllButton.addEventListener("click", resetAllControls);
resetTransformButton.addEventListener("click", () => resetKeys(transformKeys));
resetShadowButton.addEventListener("click", () => resetKeys(shadowKeys));
resetTailButton.addEventListener("click", () => resetKeys(tailKeys));

refreshPresetOptions("built-in:0");
syncControlsFromState(controls, state);
render();

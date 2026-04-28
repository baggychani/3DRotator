const STORAGE_KEY = "3d-rotator-user-presets";

export function readUserPresets() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
  } catch {
    return [];
  }
}

function isPresetLike(value) {
  return (
    value &&
    typeof value === "object" &&
    typeof value.name === "string" &&
    value.values &&
    typeof value.values === "object"
  );
}

export function writeUserPresets(presets) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(presets));
}

export function createPresetExportData() {
  return {
    app: "3D Rotator",
    version: 1,
    exportedAt: new Date().toISOString(),
    presets: readUserPresets(),
  };
}

export function importUserPresets(data) {
  const importedPresets = Array.isArray(data) ? data : data?.presets;

  if (!Array.isArray(importedPresets) || !importedPresets.every(isPresetLike)) {
    throw new Error("프리셋 JSON 형식이 올바르지 않습니다.");
  }

  const existingPresets = readUserPresets();
  writeUserPresets([...existingPresets, ...importedPresets]);

  return importedPresets.length;
}

export function getPresetOptions(builtInPresets) {
  return [
    ...builtInPresets.map((preset, index) => ({
      id: `built-in:${index}`,
      name: preset.name,
      values: preset.values,
      removable: false,
    })),
    ...readUserPresets().map((preset, index) => ({
      id: `user:${index}`,
      name: preset.name,
      values: preset.values,
      removable: true,
    })),
  ];
}

export function saveUserPreset(name, values) {
  const presets = readUserPresets();
  presets.push({ name, values });
  writeUserPresets(presets);
}

export function deleteUserPreset(userIndex) {
  const presets = readUserPresets();
  presets.splice(userIndex, 1);
  writeUserPresets(presets);
}

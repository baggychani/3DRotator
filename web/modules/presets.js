const STORAGE_KEY = "3d-rotator-user-presets";

function readUserPresets() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
  } catch {
    return [];
  }
}

function writeUserPresets(presets) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(presets));
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

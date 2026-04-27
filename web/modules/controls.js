export function readControlValue(control) {
  if (control.type === "checkbox") {
    return control.checked;
  }

  if (control.type === "color" || control.tagName === "SELECT") {
    return control.value;
  }

  return Number(control.value);
}

function syncOutputForControl(control) {
  const output = document.querySelector(`[data-output-for="${control.dataset.control}"]`);

  if (output) {
    output.value = `${control.value}°`;
    output.textContent = `${control.value}°`;
  }
}

function resetControlToDefault(control, state, initialState, onChange) {
  const key = control.dataset.control;

  if (!(key in initialState)) {
    return;
  }

  state[key] = initialState[key];
  if (control.type === "checkbox") {
    control.checked = state[key];
  } else {
    control.value = state[key];
  }
  syncOutputForControl(control);
  onChange();
}

export function syncControlsFromState(controls, state) {
  for (const control of controls) {
    const key = control.dataset.control;
    if (control.type === "checkbox") {
      control.checked = state[key];
    } else {
      control.value = state[key];
    }
    syncOutputForControl(control);
  }
}

export function bindControlEvents(controls, state, initialState, onChange) {
  for (const control of controls) {
    control.addEventListener("input", () => {
      state[control.dataset.control] = readControlValue(control);
      syncOutputForControl(control);
      onChange();
    });
    control.addEventListener("dblclick", () =>
      resetControlToDefault(control, state, initialState, onChange),
    );
  }
}

export function readControlValue(control) {
  if (control.type === "checkbox") {
    return control.checked;
  }

  if (control.type === "color" || control.tagName === "SELECT") {
    return control.value;
  }

  return Number(control.value);
}

const touchPointerQuery = window.matchMedia("(pointer: coarse)");
const MOBILE_THUMB_HIT_RADIUS = 30;

function syncOutputForControl(control) {
  const output = document.querySelector(`[data-output-for="${control.dataset.control}"]`);

  if (output) {
    output.value = `${control.value}°`;
    output.textContent = `${control.value}°`;
  }
}

function getRangeStepValue(control, clientX) {
  const rect = control.getBoundingClientRect();
  const min = Number(control.min);
  const max = Number(control.max);
  const step = Number(control.step || 1);
  const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
  const rawValue = min + (max - min) * ratio;
  const steppedValue = Math.round((rawValue - min) / step) * step + min;

  return Math.min(max, Math.max(min, steppedValue));
}

function getRangeThumbX(control) {
  const rect = control.getBoundingClientRect();
  const min = Number(control.min);
  const max = Number(control.max);
  const ratio = (Number(control.value) - min) / (max - min);

  return rect.left + rect.width * ratio;
}

function isTouchRangePointer(event) {
  return event.pointerType === "touch" || event.pointerType === "pen" || touchPointerQuery.matches;
}

function setRangeValue(control, state, onChange, value) {
  control.value = String(value);
  state[control.dataset.control] = readControlValue(control);
  syncOutputForControl(control);
  onChange();
}

function bindTouchRangeDrag(control, state, onChange) {
  if (control.type !== "range") {
    return;
  }

  let activePointerId = null;

  control.addEventListener("pointerdown", (event) => {
    if (!isTouchRangePointer(event) || event.pointerType === "mouse") {
      return;
    }

    event.preventDefault();

    if (Math.abs(event.clientX - getRangeThumbX(control)) > MOBILE_THUMB_HIT_RADIUS) {
      return;
    }

    activePointerId = event.pointerId;
    control.setPointerCapture(event.pointerId);
  });

  control.addEventListener("pointermove", (event) => {
    if (event.pointerId !== activePointerId) {
      return;
    }

    event.preventDefault();
    setRangeValue(control, state, onChange, getRangeStepValue(control, event.clientX));
  });

  for (const eventName of ["pointerup", "pointercancel"]) {
    control.addEventListener(eventName, (event) => {
      if (event.pointerId !== activePointerId) {
        return;
      }

      activePointerId = null;

      if (control.hasPointerCapture(event.pointerId)) {
        control.releasePointerCapture(event.pointerId);
      }
    });
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
    bindTouchRangeDrag(control, state, onChange);
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

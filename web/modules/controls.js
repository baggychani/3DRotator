export function readControlValue(control) {
  if (control.type === "checkbox") {
    return control.checked;
  }

  if (control.type === "radio") {
    return control.value;
  }

  if (control.type === "color" || control.tagName === "SELECT" || control.type === "hidden") {
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

  const dragSurface = control.closest("label");
  let activePointerId = null;

  if (!dragSurface) {
    return;
  }

  control.classList.add("touch-range-drag");
  dragSurface.classList.add("touch-range-surface");

  function finishDrag(event) {
    if (event.pointerId !== activePointerId) {
      return;
    }

    event.preventDefault();
    activePointerId = null;
    dragSurface.classList.remove("is-dragging-range");
    window.removeEventListener("pointermove", handleDragMove);
    window.removeEventListener("pointerup", finishDrag);
    window.removeEventListener("pointercancel", finishDrag);

    if (dragSurface.hasPointerCapture(event.pointerId)) {
      dragSurface.releasePointerCapture(event.pointerId);
    }
  }

  function handleDragMove(event) {
    if (event.pointerId !== activePointerId) {
      return;
    }

    event.preventDefault();
    setRangeValue(control, state, onChange, getRangeStepValue(control, event.clientX));
  }

  dragSurface.addEventListener("pointerdown", (event) => {
    if (!isTouchRangePointer(event) || event.pointerType === "mouse") {
      return;
    }

    const rect = control.getBoundingClientRect();
    const isNearTrackY =
      event.clientY >= rect.top - MOBILE_THUMB_HIT_RADIUS &&
      event.clientY <= rect.bottom + MOBILE_THUMB_HIT_RADIUS;

    if (
      !isNearTrackY ||
      Math.abs(event.clientX - getRangeThumbX(control)) > MOBILE_THUMB_HIT_RADIUS
    ) {
      return;
    }

    event.preventDefault();
    activePointerId = event.pointerId;
    dragSurface.classList.add("is-dragging-range");
    dragSurface.setPointerCapture(event.pointerId);
    window.addEventListener("pointermove", handleDragMove, { passive: false });
    window.addEventListener("pointerup", finishDrag, { passive: false });
    window.addEventListener("pointercancel", finishDrag, { passive: false });
  });
}

function resetControlToDefault(control, state, initialState, onChange) {
  const key = control.dataset.control;

  if (!(key in initialState)) {
    return;
  }

  state[key] = initialState[key];
  if (control.type === "checkbox") {
    control.checked = state[key];
  } else if (control.type === "radio") {
    control.checked = control.value === state[key];
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
    } else if (control.type === "radio") {
      control.checked = control.value === state[key];
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

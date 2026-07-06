export const floatingToggleClient = `
  const floatingToggleMargin = 8;
  const floatingToggleDragThreshold = 4;
  let floatingToggleDrag = null;
  let suppressFloatingToggleClick = false;

  function bindFloatingToggle(toggle) {
    toggle.addEventListener("pointerdown", (event) => {
      if (event.button !== 0) return;
      const box = toggle.getBoundingClientRect();
      floatingToggleDrag = {
        moved: false,
        offsetX: event.clientX - box.left,
        offsetY: event.clientY - box.top,
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
      };
      toggle.dataset.dragging = "true";
      if (typeof toggle.setPointerCapture === "function") toggle.setPointerCapture(event.pointerId);
    });

    toggle.addEventListener("pointermove", (event) => {
      if (!floatingToggleDrag || floatingToggleDrag.pointerId !== event.pointerId) return;
      const distance = Math.hypot(event.clientX - floatingToggleDrag.startX, event.clientY - floatingToggleDrag.startY);
      if (!floatingToggleDrag.moved && distance < floatingToggleDragThreshold) return;
      floatingToggleDrag.moved = true;
      event.preventDefault();
      moveFloatingToggle(toggle, event.clientX - floatingToggleDrag.offsetX, event.clientY - floatingToggleDrag.offsetY);
    });

    const finishDrag = (event) => {
      if (!floatingToggleDrag || floatingToggleDrag.pointerId !== event.pointerId) return;
      const moved = floatingToggleDrag.moved;
      floatingToggleDrag = null;
      if (typeof toggle.releasePointerCapture === "function") toggle.releasePointerCapture(event.pointerId);
      delete toggle.dataset.dragging;
      if (moved && event.type === "pointerup") {
        suppressFloatingToggleClick = true;
        event.preventDefault();
      }
    };

    toggle.addEventListener("pointerup", finishDrag);
    toggle.addEventListener("pointercancel", finishDrag);
    window.addEventListener("resize", () => clampFloatingToggle(toggle));
  }

  function consumeFloatingToggleClick(event) {
    if (!suppressFloatingToggleClick) return false;
    suppressFloatingToggleClick = false;
    event.preventDefault();
    event.currentTarget.setAttribute("aria-pressed", String(state.active));
    return true;
  }

  function moveFloatingToggle(toggle, left, top) {
    const box = toggle.getBoundingClientRect();
    const maxLeft = Math.max(floatingToggleMargin, window.innerWidth - box.width - floatingToggleMargin);
    const maxTop = Math.max(floatingToggleMargin, window.innerHeight - box.height - floatingToggleMargin);
    const clampedLeft = Math.min(Math.max(left, floatingToggleMargin), maxLeft);
    const clampedTop = Math.min(Math.max(top, floatingToggleMargin), maxTop);
    toggle.style.left = clampedLeft + "px";
    toggle.style.top = clampedTop + "px";
    toggle.style.right = "auto";
    toggle.style.bottom = "auto";
  }

  function clampFloatingToggle(toggle) {
    if (!toggle.style.left || !toggle.style.top) return;
    const box = toggle.getBoundingClientRect();
    moveFloatingToggle(toggle, box.left, box.top);
  }
`;

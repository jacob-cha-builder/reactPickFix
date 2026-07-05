export const cursorTargetClient = `
  function setCursorTarget(target) {
    if (state.cursorTarget === target) return;
    clearCursorTarget();
    state.cursorTarget = target;
    target.setAttribute("data-pickfix-cursor-target", "");
  }

  function clearCursorTarget() {
    if (state.cursorTarget instanceof Element) state.cursorTarget.removeAttribute("data-pickfix-cursor-target");
    state.cursorTarget = null;
  }
`;

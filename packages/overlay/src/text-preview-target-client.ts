export const textPreviewTargetClient = `
  function resolveTextPreviewTarget(originalTarget) {
    if (!(originalTarget instanceof HTMLElement) || !isVisibleElement(originalTarget)) return null;
    if (hasOwnVisibleText(originalTarget)) return originalTarget;

    const matches = [];
    originalTarget.querySelectorAll("*").forEach((element) => {
      if (element instanceof HTMLElement && isVisibleElement(element) && hasOwnVisibleText(element)) matches.push(element);
    });
    return matches.length === 1 ? matches[0] : null;
  }

  function hasOwnVisibleText(element) {
    return Array.from(element.childNodes).some((node) => node.nodeType === Node.TEXT_NODE && node.textContent && node.textContent.trim().length > 0);
  }

  function isVisibleElement(element) {
    const box = element.getBoundingClientRect();
    if (box.width === 0 || box.height === 0) return false;
    const style = getComputedStyle(element);
    return style.display !== "none" && style.visibility !== "hidden" && Number(style.opacity) !== 0;
  }
`;

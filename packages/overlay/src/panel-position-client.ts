export const panelPositionClient = `
  function updatePanelPosition() {
    const panel = document.querySelector("[data-pickfix-panel]");
    if (!(panel instanceof HTMLElement) || panel.hidden) return;
    const target = panelAnchorTarget();
    if (!(target instanceof HTMLElement) || !state.active) return;

    const margin = 8;
    const gap = 12;
    const targetBox = target.getBoundingClientRect();
    const panelBox = panel.getBoundingClientRect();
    const panelWidth = Math.min(panelBox.width || 360, window.innerWidth - margin * 2);
    const panelHeight = Math.min(panelBox.height || 320, window.innerHeight - margin * 2);
    const bestRect = bestPanelRect(targetBox, target, { gap, height: panelHeight, margin, width: panelWidth });

    panel.style.left = bestRect.left + "px";
    panel.style.top = bestRect.top + "px";
    panel.style.right = "auto";
    panel.style.bottom = "auto";
  }

  function panelAnchorTarget() {
    const pinned = state.pinnedTarget instanceof HTMLElement ? state.pinnedTarget : null;
    const original = state.originalTarget instanceof HTMLElement ? state.originalTarget : null;
    if (pinned && original) {
      if (pinned.contains(original)) return pinned;
      if (original.contains(pinned)) return original;
    }
    return pinned || original;
  }

  function bestPanelRect(targetBox, target, geometry) {
    const candidates = [
      { left: targetBox.right + geometry.gap, top: targetBox.top },
      { left: targetBox.left - geometry.gap - geometry.width, top: targetBox.top },
      { left: targetBox.right + geometry.gap, top: targetBox.bottom - geometry.height },
      { left: targetBox.left - geometry.gap - geometry.width, top: targetBox.bottom - geometry.height },
      { left: targetBox.left, top: targetBox.bottom + geometry.gap },
      { left: targetBox.left, top: targetBox.top - geometry.gap - geometry.height },
    ];
    let best = clampedPanelRect(candidates[0], geometry);
    let bestScore = Number.POSITIVE_INFINITY;
    candidates.forEach((candidate, index) => {
      const rect = clampedPanelRect(candidate, geometry);
      const score =
        overlapArea(rect, targetBox) * 1000000 +
        nearbySourceOverlapArea(rect, target, targetBox) * 100000 +
        sourceOverlapArea(rect, target) * 500 +
        index * 100;
      if (score < bestScore) {
        best = rect;
        bestScore = score;
      }
    });
    return best;
  }

  function clampedPanelRect(candidate, geometry) {
    const left = Math.min(Math.max(candidate.left, geometry.margin), window.innerWidth - geometry.margin - geometry.width);
    const top = Math.min(Math.max(candidate.top, geometry.margin), window.innerHeight - geometry.margin - geometry.height);
    return { bottom: top + geometry.height, left, right: left + geometry.width, top };
  }

  function sourceOverlapArea(rect, selectedTarget) {
    let total = 0;
    document.querySelectorAll(sourceSelector).forEach((element) => {
      if (!(element instanceof HTMLElement) || element === selectedTarget || element.contains(selectedTarget) || selectedTarget.contains(element)) return;
      if (!isVisibleElement(element)) return;
      total += overlapArea(rect, element.getBoundingClientRect());
    });
    return total;
  }

  function nearbySourceOverlapArea(rect, selectedTarget, selectedBox) {
    let total = 0;
    document.querySelectorAll(sourceSelector).forEach((element) => {
      if (!(element instanceof HTMLElement) || element === selectedTarget || element.contains(selectedTarget) || selectedTarget.contains(element)) return;
      if (!isVisibleElement(element)) return;
      const box = element.getBoundingClientRect();
      if (!isNearSelectedBox(box, selectedBox)) return;
      total += overlapArea(rect, box);
    });
    return total;
  }

  function isNearSelectedBox(box, selectedBox) {
    const band = 24;
    const verticalBand = box.bottom >= selectedBox.top - band && box.top <= selectedBox.bottom + band;
    const horizontalBand = box.right >= selectedBox.left - band && box.left <= selectedBox.right + band;
    return verticalBand || horizontalBand;
  }

  function overlapArea(first, second) {
    const width = Math.max(0, Math.min(first.right, second.right) - Math.max(first.left, second.left));
    const height = Math.max(0, Math.min(first.bottom, second.bottom) - Math.max(first.top, second.top));
    return width * height;
  }
`;

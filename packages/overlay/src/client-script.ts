import { overlayMarkup } from "./overlay-markup.js";
import { overlayStyles } from "./overlay-styles.js";
import { componentSelectionClient } from "./component-selection-client.js";
import { cursorTargetClient } from "./cursor-target-client.js";
import { domSnapshotClient } from "./dom-snapshot-client.js";
import { floatingToggleClient } from "./floating-toggle-client.js";
import { panelPositionClient } from "./panel-position-client.js";
import { promptComposerClient } from "./prompt-composer-client.js";
import { runtimeResolverClient } from "./runtime-resolver-client.js";
import { selectionContextClient } from "./selection-context-client.js";
import { textPreviewTargetClient } from "./text-preview-target-client.js";

export const pickfixOverlayClientScript = `
(() => {
  const rootId = "pickfix-overlay-root";
  const sourceSelector = "[data-pickfix-id]";
  const state = { active: false, hoverTarget: null, pinnedTarget: null, originalTarget: null, textPreviewTarget: null, cursorTarget: null, context: null, requestId: 0, selectionGeneration: 0, contextAbortController: null, promptAbortController: null, clipboardWriteCount: 0 };
  const addedTabIndexTargets = new Set();

${runtimeResolverClient}

  window.__pickfixResolveElement = resolveElement;

  function mount() {
    if (document.getElementById(rootId)) return;
    document.head.appendChild(styleElement());
    const root = document.createElement("div");
    root.id = rootId;
    root.innerHTML = ${JSON.stringify(overlayMarkup)};
    document.body.appendChild(root);
    const toggle = root.querySelector("[data-pickfix-toggle]");
    toggle.addEventListener("click", toggleActive);
    bindFloatingToggle(toggle);
    root.querySelector("[data-pickfix-reset]").addEventListener("click", clearSelection);
    root.querySelector("[data-pickfix-close]").addEventListener("click", clearSelection);
    bindPromptComposer(root);
    document.addEventListener("pointerover", handlePointerOver, true);
    document.addEventListener("click", handleClick, true);
    document.addEventListener("keydown", handleKeyDown, true);
    document.addEventListener("scroll", updateOutlines, true);
    window.addEventListener("resize", updateOutlines);
  }

  function styleElement() {
    const style = document.createElement("style");
    style.textContent = ${JSON.stringify(overlayStyles)};
    return style;
  }

${floatingToggleClient}

  function toggleActive(event) {
    if (consumeFloatingToggleClick(event)) return;
    if (selectionLockedByClipboard()) {
      event.currentTarget.setAttribute("aria-pressed", String(state.active));
      return;
    }
    state.active = !state.active;
    event.currentTarget.setAttribute("aria-pressed", String(state.active));
    if (state.active) refreshFocusableTargets();
    else clearSelectionAndRestoreTargets();
  }

  function refreshFocusableTargets() {
    document.querySelectorAll(sourceSelector).forEach((element) => {
      if (isOverlayElement(element) || element.hasAttribute("tabindex")) return;
      element.setAttribute("tabindex", "0");
      addedTabIndexTargets.add(element);
    });
  }

  function restoreFocusableTargets() {
    addedTabIndexTargets.forEach((element) => {
      if (element.isConnected) element.removeAttribute("tabindex");
    });
    addedTabIndexTargets.clear();
  }

  function clearSelectionAndRestoreTargets() {
    clearSelection();
    restoreFocusableTargets();
  }

  function cancelPendingContext() {
    state.requestId += 1;
    if (state.contextAbortController) {
      state.contextAbortController.abort();
      state.contextAbortController = null;
    }
  }

  function cancelPendingPrompt() {
    if (state.promptAbortController) {
      state.promptAbortController.abort();
      state.promptAbortController = null;
    }
  }

  function blockHostClick(event) {
    event.preventDefault();
    event.stopPropagation();
    if (typeof event.stopImmediatePropagation === "function") event.stopImmediatePropagation();
  }

  function selectionLockedByClipboard() {
    if (state.clipboardWriteCount < 1) return false;
    setPromptStatus("Copy in progress");
    return true;
  }

  function handlePointerOver(event) {
    if (!state.active) return;
    if (pointerInsidePanel(event)) {
      clearCursorTarget();
      return;
    }
    const target = pickTarget(event.target);
    if (!target) {
      clearCursorTarget();
      return;
    }
    state.hoverTarget = target;
    setCursorTarget(target);
    updateOutlines();
  }

${cursorTargetClient}

  function pointerInsidePanel(event) {
    const panel = document.querySelector("[data-pickfix-panel]");
    if (!(panel instanceof HTMLElement) || panel.hidden) return false;
    const box = panel.getBoundingClientRect();
    return event.clientX >= box.left && event.clientX <= box.right && event.clientY >= box.top && event.clientY <= box.bottom;
  }

  function handleClick(event) {
    if (!state.active) return;
    const target = pickTarget(event.target);
    if (!target) return;
    blockHostClick(event);
    if (selectionLockedByClipboard()) return;
    pinTarget(target, event.target);
  }

  function handleKeyDown(event) {
    if (event.key === "Escape") {
      if (selectionLockedByClipboard()) {
        event.preventDefault();
        return;
      }
      if (state.hoverTarget || state.pinnedTarget) clearSelection();
      return;
    }
    if (!state.active || event.key !== "Enter") return;
    const activeElement = document.activeElement;
    const target = activeElement ? pickTarget(activeElement) : null;
    if (target) {
      event.preventDefault();
      if (selectionLockedByClipboard()) return;
      pinTarget(target, activeElement);
    }
  }

  function pickTarget(value) {
    if (!(value instanceof Element) || isOverlayElement(value)) return null;
    const metadataTarget = value.closest(sourceSelector);
    if (metadataTarget && !isOverlayElement(metadataTarget)) return metadataTarget;
    return value;
  }

  function isOverlayElement(element) {
    return Boolean(element.closest("#" + rootId));
  }

${componentSelectionClient}
${textPreviewTargetClient}
${panelPositionClient}
${selectionContextClient}

  async function pinTarget(target, originalTarget) {
    state.selectionGeneration += 1;
    cancelPendingContext();
    cancelPendingPrompt();
    resetPromptComposerSelectionState(false);
    const requestId = state.requestId;
    state.pinnedTarget = target;
    state.originalTarget = originalTarget instanceof Element ? originalTarget : target;
    state.textPreviewTarget = resolveTextPreviewTarget(state.originalTarget);
    syncTextEditField();
    state.hoverTarget = state.originalTarget;
    setCursorTarget(state.originalTarget);
    updateOutlines();
    const resolution = resolveElement(target);
    const context = await contextForResolution(resolution, requestId, target);
    if (!context || !state.active || state.requestId !== requestId || state.pinnedTarget !== target) return;
    const selection = await componentSelectionForTarget(target, context, requestId);
    if (!selection || !state.active || state.requestId !== requestId) return;
    state.pinnedTarget = selection.target;
    state.hoverTarget = state.originalTarget;
    state.context = selection.context;
    updateOutlines();
    renderPanel();
  }

  function renderPanel() {
    const panel = document.querySelector("[data-pickfix-panel]");
    const context = state.context;
    if (!panel || !context) return;
    const source = context.source;
    const location = source.line > 0 ? source.file + ":" + source.line + ":" + source.column : source.file;
    panel.querySelector("[data-pickfix-component-name]").textContent = source.componentName;
    panel.querySelector("[data-pickfix-source-location]").textContent = location;
    const confidence = panel.querySelector("[data-pickfix-confidence]");
    confidence.textContent = context.confidence;
    confidence.dataset.confidence = context.confidence;
    panel.querySelector("[data-pickfix-reason]").textContent = userFacingReason(context);
    panel.hidden = false;
    updatePanelPosition();
  }

${promptComposerClient}

  function clearSelection() {
    if (selectionLockedByClipboard()) return;
    state.selectionGeneration += 1;
    cancelPendingContext();
    state.hoverTarget = null;
    state.pinnedTarget = null;
    state.originalTarget = null;
    state.textPreviewTarget = null;
    clearCursorTarget();
    state.context = null;
    cancelPendingPrompt(); resetPromptComposerSelectionState(true);
    const panel = document.querySelector("[data-pickfix-panel]");
    if (panel) panel.hidden = true;
    updateOutlines();
  }

${domSnapshotClient}

  function updateOutlines() {
    drawOutline(document.querySelector("[data-pickfix-hover-outline]"), state.hoverTarget);
    drawOutline(document.querySelector("[data-pickfix-pinned-outline]"), state.originalTarget || state.pinnedTarget);
    updatePanelPosition();
    updateCommentMarkers();
  }

  function drawOutline(outline, target) {
    if (!outline || !target || !state.active) {
      if (outline) outline.hidden = true;
      return;
    }
    const box = target.getBoundingClientRect();
    outline.style.left = box.left - 2 + "px";
    outline.style.top = box.top - 2 + "px";
    outline.style.width = box.width + 4 + "px";
    outline.style.height = box.height + 4 + "px";
    outline.hidden = false;
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mount, { once: true }); else mount();
  window.dispatchEvent(new CustomEvent("pickfix:ready"));
})();
`;

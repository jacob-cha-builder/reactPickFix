import { overlayMarkup } from "./overlay-markup.js";
import { overlayStyles } from "./overlay-styles.js";
import { domSnapshotClient } from "./dom-snapshot-client.js";
import { promptComposerClient } from "./prompt-composer-client.js";
import { runtimeResolverClient } from "./runtime-resolver-client.js";

export const pickfixOverlayClientScript = `
(() => {
  const rootId = "pickfix-overlay-root";
  const sourceSelector = "[data-pickfix-id]";
  const state = { active: false, hoverTarget: null, pinnedTarget: null, context: null, requestId: 0, selectionGeneration: 0, contextAbortController: null, promptAbortController: null, clipboardWriteCount: 0 };
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
    root.querySelector("[data-pickfix-toggle]").addEventListener("click", toggleActive);
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

  function toggleActive(event) {
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

  function userFacingReason(context) {
    if (context.confidence === "high") return "Matched component source";
    if (context.confidence === "medium") return "Matched nearby component";
    return "Could not match this element to source";
  }

  function fallbackContext(resolution) {
    return {
      confidence: resolution.confidence,
      source: { componentName: resolution.ownerChain[0] || "Unmapped element", file: "No source metadata", line: 0, column: 0 },
      ownerChain: resolution.ownerChain,
      reason: userFacingReason(resolution),
    };
  }

  function isAbortError(error) {
    return error instanceof DOMException && error.name === "AbortError";
  }

  function handlePointerOver(event) {
    if (!state.active) return;
    const target = pickTarget(event.target);
    if (!target) return;
    state.hoverTarget = target;
    updateOutlines();
  }

  function handleClick(event) {
    if (!state.active) return;
    const target = pickTarget(event.target);
    if (!target) return;
    blockHostClick(event);
    if (selectionLockedByClipboard()) return;
    pinTarget(target);
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
      pinTarget(target);
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

  async function pinTarget(target) {
    state.selectionGeneration += 1;
    cancelPendingContext();
    cancelPendingPrompt(); resetPromptComposerSelectionState();
    const requestId = state.requestId;
    state.pinnedTarget = target;
    state.hoverTarget = target;
    updateOutlines();
    const resolution = resolveElement(target);
    const context = await contextForResolution(resolution, requestId);
    if (!context || !state.active || state.requestId !== requestId || state.pinnedTarget !== target) return;
    state.context = context;
    renderPanel();
  }

  async function contextForResolution(resolution, requestId) {
    const controller = new AbortController();
    if (state.requestId === requestId) state.contextAbortController = controller;
    if (resolution.confidence === "high" || resolution.module) {
      try {
        const parameters = new URLSearchParams({ id: resolution.selectionId });
        if (resolution.module) parameters.set("module", resolution.module);
        parameters.set("dom", domSnapshot(state.pinnedTarget));
        const response = await fetch("/__pickfix/context?" + parameters.toString(), { signal: controller.signal });
        if (response.ok) return response.json();
      } catch (error) {
        if (isAbortError(error)) return null;
        throw error;
      } finally {
        if (state.contextAbortController === controller) state.contextAbortController = null;
      }
    }
    if (state.contextAbortController === controller) state.contextAbortController = null;
    return fallbackContext(resolution);
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
  }

${promptComposerClient}

  function clearSelection() {
    if (selectionLockedByClipboard()) return;
    state.selectionGeneration += 1;
    cancelPendingContext();
    state.hoverTarget = null;
    state.pinnedTarget = null;
    state.context = null;
    cancelPendingPrompt();
    const panel = document.querySelector("[data-pickfix-panel]");
    if (panel) panel.hidden = true;
    updateOutlines();
  }

${domSnapshotClient}

  function updateOutlines() {
    drawOutline(document.querySelector("[data-pickfix-hover-outline]"), state.hoverTarget);
    drawOutline(document.querySelector("[data-pickfix-pinned-outline]"), state.pinnedTarget);
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

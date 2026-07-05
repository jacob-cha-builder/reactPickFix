import { promptComposerCommentsClient } from "./prompt-composer-comments-client.js";
import { promptComposerPreviewClient } from "./prompt-composer-preview-client.js";

export const promptComposerClient = `
${promptComposerCommentsClient}
${promptComposerPreviewClient}

  function bindPromptComposer(root) {
    root.querySelector("[data-pickfix-composer]").addEventListener("submit", copyPrompt);
    root.querySelector("[data-pickfix-add-comment]").addEventListener("click", addCollectedComment);
    root.querySelector("[data-pickfix-clipboard-dismiss]").addEventListener("click", clearClipboardFallback);
    bindSlider(root, "[data-pickfix-intent-size]", "[data-pickfix-size-value]", fontSizeLabel);
    bindSlider(root, "[data-pickfix-intent-position-x]", "[data-pickfix-position-x-value]", pixelLabel);
    bindSlider(root, "[data-pickfix-intent-position-y]", "[data-pickfix-position-y-value]", pixelLabel);
    document.addEventListener("pointermove", trackCommentListPointer, true);
    document.addEventListener("wheel", scrollCommentListAtPointer, { capture: true, passive: false });
    document.addEventListener("scroll", updateCommentMarkers, true);
    window.addEventListener("scroll", updateCommentMarkers);
    window.addEventListener("resize", updateCommentMarkers);
  }

  async function copyPrompt(event) {
    event.preventDefault();
    const result = await requestPrompt("generic");
    if (!result) return;
    const payload = result.payload;
    await copyHandoffText(payload.prompt, "Prompt copied", result.selectionId, result.selectionGeneration);
    if (!isCurrentPromptSelection(result.selectionId, result.selectionGeneration)) return;
    showPromptOutput(payload.prompt);
  }

  async function requestPrompt(target) {
    const context = state.context;
    if (!context || !context.source || !context.source.id) {
      setPromptStatus("Select a component first");
      return null;
    }
    const selectionId = context.source.id;
    const selectionGeneration = state.selectionGeneration;
    if (state.promptAbortController) state.promptAbortController.abort();
    const controller = new AbortController();
    state.promptAbortController = controller;
    setPromptStatus("Preparing prompt");
    try {
      const response = await fetch("/__pickfix/prompt", {
        body: JSON.stringify({ selectionId, change: promptChange(), target }),
        headers: { "content-type": "application/json" },
        method: "POST",
        signal: controller.signal,
      });
      const payload = await response.json();
      if (!response.ok || !payload || !payload.ok || typeof payload.prompt !== "string") {
        if (isCurrentPromptSelection(selectionId, selectionGeneration)) setPromptStatus(payload.message || "Prompt could not be generated");
        return null;
      }
      if (!isCurrentPromptSelection(selectionId, selectionGeneration)) return null;
      return { payload, selectionGeneration, selectionId };
    } catch (error) {
      if (isAbortError(error)) return null;
      if (error instanceof Error) {
        if (isCurrentPromptSelection(selectionId, selectionGeneration)) setPromptStatus("Prompt could not be generated");
        return null;
      }
      throw error;
    } finally {
      if (state.promptAbortController === controller) state.promptAbortController = null;
    }
  }

  function isCurrentPromptSelection(selectionId, selectionGeneration) {
    if (state.selectionGeneration !== selectionGeneration) return false;
    const context = state.context;
    return Boolean(context && context.source && context.source.id === selectionId);
  }

  function promptChange() {
    const comments = promptComments();
    const textEdit = textEditDraft();
    return {
      comments,
      text: comments ? undefined : fieldValue("[data-pickfix-intent-text]"),
      textEdit: comments ? undefined : textEdit,
      size: fontSizePhrase(),
      position: positionPhrase(),
    };
  }

  function textEditDraft() {
    const field = document.querySelector("[data-pickfix-intent-text-replacement]");
    const wrapper = document.querySelector("[data-pickfix-text-edit]");
    if (!(field instanceof HTMLTextAreaElement) || !(wrapper instanceof HTMLElement) || wrapper.hidden) return undefined;
    const from = field.dataset.pickfixOriginalText || "";
    const to = field.value.trim();
    if (!from || !to || from === to) return undefined;
    return { from, target: selectedComponentName(), to };
  }

  function textEditPhrase() {
    const draft = textEditDraft();
    return draft ? "Text 수정: replace " + quoteText(draft.from) + " with " + quoteText(draft.to) : undefined;
  }

  function quoteText(value) {
    return JSON.stringify(value);
  }

  function syncTextEditField() {
    const wrapper = document.querySelector("[data-pickfix-text-edit]");
    const field = document.querySelector("[data-pickfix-intent-text-replacement]");
    if (!(wrapper instanceof HTMLElement) || !(field instanceof HTMLTextAreaElement)) return;
    const target = state.textPreviewTarget;
    if (!(target instanceof HTMLElement)) {
      wrapper.hidden = true;
      field.value = "";
      delete field.dataset.pickfixOriginalText;
      syncFontSizeField(false);
      return;
    }
    const sourceText = textEditSourceText(target);
    if (!sourceText) {
      wrapper.hidden = true;
      field.value = "";
      delete field.dataset.pickfixOriginalText;
      syncFontSizeField(false);
      return;
    }
    wrapper.hidden = false;
    field.dataset.pickfixOriginalText = sourceText;
    field.value = sourceText;
    syncFontSizeField(true);
  }

  function resetTextEditFieldToOriginal() {
    const wrapper = document.querySelector("[data-pickfix-text-edit]");
    const field = document.querySelector("[data-pickfix-intent-text-replacement]");
    if (!(wrapper instanceof HTMLElement) || !(field instanceof HTMLTextAreaElement)) return;
    if (!(state.textPreviewTarget instanceof HTMLElement)) {
      wrapper.hidden = true;
      field.value = "";
      delete field.dataset.pickfixOriginalText;
      syncFontSizeField(false);
      return;
    }
    const sourceText = field.dataset.pickfixOriginalText || textEditSourceText(state.textPreviewTarget);
    wrapper.hidden = !sourceText;
    field.value = sourceText;
    if (sourceText) field.dataset.pickfixOriginalText = sourceText;
    else delete field.dataset.pickfixOriginalText;
    syncFontSizeField(Boolean(sourceText));
  }

  function textEditSourceText(target) {
    const text = target.textContent || "";
    return text.replace(/\\s+/g, " ").trim();
  }

  function syncFontSizeField(available) {
    const wrapper = document.querySelector("[data-pickfix-font-size-field]");
    if (!(wrapper instanceof HTMLElement)) return;
    wrapper.hidden = !available;
    if (!available) resetSlider("[data-pickfix-intent-size]", "[data-pickfix-size-value]", fontSizeLabel);
  }

  function fieldValue(selector) {
    const field = document.querySelector(selector);
    const value = field && typeof field.value === "string" ? field.value.trim() : "";
    return value.length > 0 ? value : undefined;
  }

  function setPromptStatus(message) {
    const status = document.querySelector("[data-pickfix-prompt-status]");
    if (status) status.textContent = message;
  }

  function showPromptOutput(prompt) {
    const field = document.querySelector("[data-pickfix-prompt-output]");
    const wrapper = document.querySelector("[data-pickfix-prompt-output-field]");
    if (!(field instanceof HTMLTextAreaElement) || !(wrapper instanceof HTMLElement)) return;
    field.value = prompt;
    wrapper.hidden = false;
    updatePanelPosition();
    field.scrollIntoView({ block: "nearest", inline: "nearest" });
  }

  function resetPromptOutput() {
    const field = document.querySelector("[data-pickfix-prompt-output]");
    const wrapper = document.querySelector("[data-pickfix-prompt-output-field]");
    if (field instanceof HTMLTextAreaElement) field.value = "";
    if (wrapper instanceof HTMLElement) wrapper.hidden = true;
  }

  async function copyHandoffText(text, copiedStatus, selectionId, selectionGeneration) {
    if (selectionId && !isCurrentPromptSelection(selectionId, selectionGeneration)) return;
    if (!text) {
      setPromptStatus("Nothing to copy");
      return;
    }
    clearClipboardFallback();
    if (!navigator.clipboard || typeof navigator.clipboard.writeText !== "function") {
      showClipboardFallback(text, selectionId, selectionGeneration);
      return;
    }
    state.clipboardWriteCount += 1;
    try {
      await navigator.clipboard.writeText(text);
      if (selectionId && !isCurrentPromptSelection(selectionId, selectionGeneration)) return;
      setPromptStatus(copiedStatus);
    } catch (error) {
      if (error instanceof DOMException || error instanceof TypeError) {
        showClipboardFallback(text, selectionId, selectionGeneration);
        return;
      }
      showClipboardFallback(text, selectionId, selectionGeneration);
    } finally {
      state.clipboardWriteCount -= 1;
    }
  }

  function showClipboardFallback(text, selectionId, selectionGeneration) {
    if (selectionId && !isCurrentPromptSelection(selectionId, selectionGeneration)) return;
    const region = document.querySelector("[data-pickfix-clipboard-fallback-region]");
    const fallback = document.querySelector("[data-pickfix-clipboard-fallback]");
    if (!region || !fallback) return;
    fallback.value = text;
    region.hidden = false;
    fallback.focus();
    fallback.select();
    setPromptStatus("Clipboard blocked. Use manual copy.");
  }

  function clearClipboardFallback() {
    const region = document.querySelector("[data-pickfix-clipboard-fallback-region]");
    const fallback = document.querySelector("[data-pickfix-clipboard-fallback]");
    if (fallback) fallback.value = "";
    if (region) region.hidden = true;
  }

  function resetPromptComposerSelectionState(clearComments) {
    clearPreview();
    clearClipboardFallback();
    if (clearComments) clearCollectedComments();
    else {
      renderCollectedComments();
      updateCommentMarkers();
    }
    resetField("[data-pickfix-intent-text]", "");
    resetTextEditFieldToOriginal();
    resetSlider("[data-pickfix-intent-size]", "[data-pickfix-size-value]", fontSizeLabel);
    resetSlider("[data-pickfix-intent-position-x]", "[data-pickfix-position-x-value]", pixelLabel);
    resetSlider("[data-pickfix-intent-position-y]", "[data-pickfix-position-y-value]", pixelLabel);
    resetPromptOutput();
    setPromptStatus("");
  }

  function resetField(selector, value) {
    const field = document.querySelector(selector);
    if (field && "value" in field) field.value = value;
  }

  function resetSlider(sliderSelector, labelSelector, formatter) {
    resetField(sliderSelector, "0");
    const label = document.querySelector(labelSelector);
    if (label) label.textContent = formatter(0);
  }
`;

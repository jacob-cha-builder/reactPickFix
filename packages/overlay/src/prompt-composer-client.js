export const promptComposerClient = `
  const codexInstruction = "Apply this component-scoped change. Follow the verification instructions in the prompt.";
  const codexCommands = {
    linux: 'xclip -selection clipboard -o | codex exec "' + codexInstruction + '"',
    mac: 'pbpaste | codex exec "' + codexInstruction + '"',
    windows: 'Get-Clipboard | codex exec "' + codexInstruction + '"',
  };

  function bindPromptComposer(root) {
    root.querySelector("[data-pickfix-copy-source]").addEventListener("click", copySource);
    root.querySelector("[data-pickfix-composer]").addEventListener("submit", generatePrompt);
    root.querySelector("[data-pickfix-copy-prompt]").addEventListener("click", () => copyPromptTarget("generic"));
    root.querySelector("[data-pickfix-copy-claude-prompt]").addEventListener("click", () => copyPromptTarget("claude"));
    root.querySelector("[data-pickfix-copy-codex-command]").addEventListener("click", copyCodexCommand);
    root.querySelector("[data-pickfix-clipboard-dismiss]").addEventListener("click", clearClipboardFallback);
  }

  async function generatePrompt(event) {
    event.preventDefault();
    const result = await requestPrompt(promptTarget());
    if (!result) return;
    if (!isCurrentPromptSelection(result.selectionId, result.selectionGeneration)) return;
    const payload = result.payload;
    const output = document.querySelector("[data-pickfix-prompt-output]");
    if (output) output.value = payload.prompt;
    setPromptStatus(payload.summary || "Prompt ready");
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
    setPromptStatus(target === "claude" ? "Preparing Claude prompt" : target === "codex" ? "Preparing Codex command" : "Preparing prompt");
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
    return {
      text: fieldValue("[data-pickfix-intent-text]"),
      size: fieldValue("[data-pickfix-intent-size]"),
      position: fieldValue("[data-pickfix-intent-position]"),
      notes: fieldValue("[data-pickfix-intent-notes]"),
    };
  }

  function promptTarget() {
    const select = document.querySelector("[data-pickfix-target]");
    return select && select.value ? select.value : "generic";
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

  function copySource() {
    const context = state.context;
    const selectionId = context && context.source ? context.source.id : undefined;
    const selectionGeneration = state.selectionGeneration;
    const source = document.querySelector("[data-pickfix-source-location]");
    const text = source ? source.textContent || "" : "";
    copyHandoffText(text, "Source copied", selectionId, selectionGeneration);
  }

  async function copyPromptTarget(target) {
    const result = await requestPrompt(target);
    if (!result) return;
    const payload = result.payload;
    await copyHandoffText(payload.prompt, target === "claude" ? "Claude prompt copied" : "Prompt copied", result.selectionId, result.selectionGeneration);
    if (!isCurrentPromptSelection(result.selectionId, result.selectionGeneration)) return;
    const output = document.querySelector("[data-pickfix-prompt-output]");
    if (output) output.value = payload.prompt;
  }

  async function copyCodexCommand() {
    const result = await requestPrompt("codex");
    if (!result) return;
    if (!isCurrentPromptSelection(result.selectionId, result.selectionGeneration)) return;
    await copyHandoffText(codexCommandText(result.payload), "Codex command copied", result.selectionId, result.selectionGeneration);
  }

  function codexCommandText(payload) {
    const command = typeof payload.command === "string" ? payload.command : codexCommands.mac;
    return [
      "Selected component: " + selectedComponentName(),
      "Copy a prompt first, then run one platform command. This overlay only copies text.",
      "",
      "macOS: " + command,
      "Linux: " + codexCommands.linux,
      "Windows PowerShell: " + codexCommands.windows,
    ].join("\\n");
  }

  function selectedComponentName() {
    const context = state.context;
    return context && context.source && context.source.componentName ? context.source.componentName : "Selected component";
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

  function resetPromptComposerSelectionState() {
    clearClipboardFallback();
    const output = document.querySelector("[data-pickfix-prompt-output]");
    if (output) output.value = "";
    setPromptStatus("");
  }
`;

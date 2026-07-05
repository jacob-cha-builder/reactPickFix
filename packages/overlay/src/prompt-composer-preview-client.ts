export const promptComposerPreviewClient = `
  const fontSizeStepPercent = 8;
  const previewTransitionMs = 100;
  let previewContainerTarget = null;
  let previewContainerStyle = null;
  let previewTextTarget = null;
  let previewTextStyle = null;

  function fontSizePhrase() {
    const value = numericSliderValue("[data-pickfix-intent-size]");
    if (value === 0) return undefined;
    return "font size " + signed(value * fontSizeStepPercent) + "%";
  }

  function positionPhrase() {
    const x = numericSliderValue("[data-pickfix-intent-position-x]");
    const y = numericSliderValue("[data-pickfix-intent-position-y]");
    const parts = [];
    if (x !== 0) parts.push("x " + signed(x) + "px");
    if (y !== 0) parts.push("y " + signed(y) + "px");
    return parts.length > 0 ? parts.join(", ") : undefined;
  }

  function bindSlider(root, sliderSelector, labelSelector, formatter) {
    const slider = root.querySelector(sliderSelector);
    const label = root.querySelector(labelSelector);
    if (!slider || !label) return;
    const update = () => {
      label.textContent = formatter(Number(slider.value));
      applyPreview();
    };
    slider.addEventListener("input", update);
    slider.addEventListener("change", update);
    update();
  }

  function numericSliderValue(selector) {
    const field = document.querySelector(selector);
    if (!field || typeof field.value !== "string") return 0;
    const value = Number(field.value);
    return Number.isFinite(value) ? value : 0;
  }

  function fontSizeLabel(value) {
    return value === 0 ? "No change" : signed(value * fontSizeStepPercent) + "%";
  }

  function pixelLabel(value) {
    return value === 0 ? "No change" : signed(value) + "px";
  }

  function signed(value) {
    return value > 0 ? "+" + value : String(value);
  }

  function applyPreview() {
    const containerTarget = state.pinnedTarget;
    if (!containerTarget || !(containerTarget instanceof HTMLElement)) return;
    captureContainerPreviewStyle(containerTarget);
    const textTarget = state.textPreviewTarget;
    if (textTarget instanceof HTMLElement) captureTextPreviewStyle(textTarget);
    const x = numericSliderValue("[data-pickfix-intent-position-x]");
    const y = numericSliderValue("[data-pickfix-intent-position-y]");
    const size = numericSliderValue("[data-pickfix-intent-size]");
    const originalTransform = previewContainerStyle && previewContainerStyle.transform ? previewContainerStyle.transform : "";
    const translate = x === 0 && y === 0 ? "" : " translate(" + x + "px, " + y + "px)";
    containerTarget.style.transform = (originalTransform + translate).trim();
    containerTarget.style.transition = x === 0 && y === 0
      ? (previewContainerStyle ? previewContainerStyle.transition : "")
      : "transform " + previewTransitionMs + "ms ease-out";
    if (previewTextTarget instanceof HTMLElement && previewTextStyle) {
      if (size === 0) {
        previewTextTarget.style.fontSize = previewTextStyle.fontSize;
        previewTextTarget.style.transition = previewTextStyle.transition;
      } else {
        const scale = 1 + (size * fontSizeStepPercent) / 100;
        previewTextTarget.style.fontSize = String(previewTextStyle.computedFontSize * scale) + "px";
        previewTextTarget.style.transition = "font-size " + previewTransitionMs + "ms ease-out";
      }
    }
    updateOutlines();
    requestAnimationFrame(updateCommentMarkers);
    window.setTimeout(updateCommentMarkers, previewTransitionMs + 20);
  }

  function captureContainerPreviewStyle(target) {
    if (previewContainerTarget === target && previewContainerStyle) return;
    clearContainerPreview();
    previewContainerTarget = target;
    previewContainerStyle = {
      transform: target.style.transform,
      transition: target.style.transition,
    };
  }

  function captureTextPreviewStyle(target) {
    if (previewTextTarget === target && previewTextStyle) return;
    clearTextPreview();
    previewTextTarget = target;
    previewTextStyle = {
      computedFontSize: Number.parseFloat(getComputedStyle(target).fontSize),
      fontSize: target.style.fontSize,
      transition: target.style.transition,
    };
  }

  function clearPreview() {
    clearTextPreview();
    clearContainerPreview();
  }

  function clearContainerPreview() {
    if (previewContainerTarget && previewContainerStyle && previewContainerTarget.isConnected) {
      previewContainerTarget.style.transform = previewContainerStyle.transform;
      previewContainerTarget.style.transition = previewContainerStyle.transition;
    }
    previewContainerTarget = null;
    previewContainerStyle = null;
  }

  function clearTextPreview() {
    if (previewTextTarget && previewTextStyle && previewTextTarget.isConnected) {
      previewTextTarget.style.fontSize = previewTextStyle.fontSize;
      previewTextTarget.style.transition = previewTextStyle.transition;
    }
    previewTextTarget = null;
    previewTextStyle = null;
  }

`;

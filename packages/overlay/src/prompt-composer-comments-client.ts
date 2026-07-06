export const promptComposerCommentsClient = `
  const maxCollectedComments = 20;
  const collectedComments = [];
  let commentListPointerInside = false;

  function addCollectedComment() {
    if (collectedComments.length >= maxCollectedComments) {
      setPromptStatus("Comment limit reached");
      return;
    }
    const comment = collectedCommentEntry();
    if (!comment) {
      setPromptStatus("Make a comment or change first");
      return;
    }
    collectedComments.push(comment);
    resetDraftAfterCollectedComment();
    renderCollectedComments();
    updateCommentMarkers();
    setPromptStatus("Comment #" + collectedComments.length + " added");
  }

  function promptComments() {
    if (collectedComments.length === 0) return undefined;
    const current = collectedCommentDetails(textEditPhrase());
    const comments = collectedComments.slice(0, maxCollectedComments).map((comment) => comment.text);
    if (current && comments.length < maxCollectedComments) comments.push(selectedComponentName() + ": " + current);
    return comments.length > 0 ? comments : undefined;
  }

  function collectedCommentEntry() {
    const textEdit = textEditPhrase();
    const text = collectedCommentText(textEdit);
    if (!text) return null;
    const target = collectedCommentMarkerTarget(textEdit);
    return target ? { target, text } : null;
  }

  function collectedCommentText(textEdit) {
    const componentName = selectedComponentName();
    const details = collectedCommentDetails(textEdit);
    return details ? componentName + ": " + details : null;
  }

  function collectedCommentDetails(textEdit) {
    const parts = [];
    const comment = fieldValue("[data-pickfix-intent-text]");
    if (textEdit) parts.push(textEdit);
    if (comment) parts.push(comment);
    if (parts.length === 0) return null;
    return parts.join("; ");
  }

  function collectedCommentMarkerTarget(textEdit) {
    if (textEdit && state.textPreviewTarget instanceof HTMLElement) return state.textPreviewTarget;
    return commentMarkerTarget();
  }

  function selectedComponentName() {
    return state.context && state.context.source && state.context.source.componentName
      ? state.context.source.componentName
      : "Selected component";
  }

  function resetDraftAfterCollectedComment() {
    clearClipboardFallback();
    resetField("[data-pickfix-intent-text]", "");
    resetTextEditFieldToOriginal();
    resetPromptOutput();
  }

  function renderCollectedComments() {
    const list = document.querySelector("[data-pickfix-comment-list]");
    if (!list) return;
    list.textContent = "";
    list.hidden = collectedComments.length === 0;
    collectedComments.forEach((comment, index) => {
      const item = document.createElement("li");
      const text = document.createElement("span");
      text.textContent = index + 1 + ". " + comment.text;
      const button = document.createElement("button");
      button.type = "button";
      button.className = "pf-comment-delete";
      button.setAttribute("aria-label", "Delete saved note " + (index + 1));
      button.textContent = "x";
      button.addEventListener("click", () => deleteCollectedComment(index));
      item.append(text, button);
      list.appendChild(item);
    });
  }

  function deleteCollectedComment(index) {
    if (index < 0 || index >= collectedComments.length) return;
    collectedComments.splice(index, 1);
    renderCollectedComments();
    updateCommentMarkers();
    resetPromptOutput();
    clearClipboardFallback();
    setPromptStatus("Comment deleted");
  }

  function scrollCommentListAtPointer(event) {
    if (!state.active || !(event instanceof WheelEvent)) return;
    const list = scrollableCommentList();
    if (!list) return;
    if (!commentListPointerInside && !isPointInsideElement(event.clientX, event.clientY, list)) return;
    const deltaY = normalizedWheelDeltaY(event, list.clientHeight);
    if (deltaY === 0) return;
    list.scrollTop += deltaY;
    event.preventDefault();
    event.stopPropagation();
  }

  function trackCommentListPointer(event) {
    const list = scrollableCommentList();
    commentListPointerInside = Boolean(list && isPointInsideElement(event.clientX, event.clientY, list));
  }

  function scrollableCommentList() {
    const list = document.querySelector("[data-pickfix-comment-list]");
    if (!(list instanceof HTMLElement) || list.hidden || list.scrollHeight <= list.clientHeight) return null;
    return list;
  }

  function isPointInsideElement(clientX, clientY, element) {
    const box = element.getBoundingClientRect();
    return clientX >= box.left && clientX <= box.right && clientY >= box.top && clientY <= box.bottom;
  }

  function normalizedWheelDeltaY(event, pageSize) {
    if (event.deltaMode === WheelEvent.DOM_DELTA_LINE) return event.deltaY * 16;
    if (event.deltaMode === WheelEvent.DOM_DELTA_PAGE) return event.deltaY * pageSize;
    return event.deltaY;
  }

  function commentMarkerTarget() {
    if (state.textPreviewTarget instanceof HTMLElement) return state.textPreviewTarget;
    if (state.originalTarget instanceof HTMLElement) return state.originalTarget;
    return state.pinnedTarget instanceof HTMLElement ? state.pinnedTarget : null;
  }

  function updateCommentMarkers() {
    const layer = document.querySelector("[data-pickfix-comment-markers]");
    if (!layer) return;
    layer.textContent = "";
    const markers = commentMarkers();
    if (!state.active || markers.length === 0) {
      layer.hidden = true;
      return;
    }
    const targetOffsets = new Map();
    markers.forEach((entry) => {
      if (!(entry.target instanceof Element) || !entry.target.isConnected) return;
      const box = entry.target.getBoundingClientRect();
      const offset = targetOffsets.get(entry.target) || 0;
      targetOffsets.set(entry.target, offset + 1);
      const marker = document.createElement("span");
      marker.className = "pf-comment-marker";
      marker.dataset.pickfixCommentMarker = "";
      marker.textContent = String(entry.number);
      marker.style.left = box.left + offset * 22 + "px";
      marker.style.top = box.top + "px";
      layer.appendChild(marker);
    });
    layer.hidden = layer.childElementCount === 0;
  }

  function commentMarkers() {
    return collectedComments.map((comment, index) => ({ number: index + 1, target: comment.target }));
  }

  function clearCollectedComments() {
    collectedComments.length = 0;
    renderCollectedComments();
    updateCommentMarkers();
  }
`;

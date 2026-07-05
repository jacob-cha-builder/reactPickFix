export const componentSelectionClient = `
  async function componentSelectionForTarget(target, initialContext, requestId) {
    if (!(target instanceof Element) || !initialContext.source) return { context: initialContext, target };
    let selectedContext = initialContext;
    let selectedTarget = target;
    let current = target.parentElement;
    while (current && !isOverlayElement(current)) {
      if (current.matches(sourceSelector)) {
        const context = await contextForResolution(resolveElement(current), requestId, current);
        if (!context || !state.active || state.requestId !== requestId) return null;
        if (isSameSourceComponent(initialContext.source, context.source) && context.source.line <= selectedContext.source.line) {
          selectedContext = context;
          selectedTarget = current;
        }
      }
      current = current.parentElement;
    }
    return { context: selectedContext, target: selectedTarget };
  }

  function isSameSourceComponent(left, right) {
    return Boolean(left && right && left.componentName === right.componentName && left.file === right.file);
  }
`;

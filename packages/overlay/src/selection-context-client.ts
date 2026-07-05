export const selectionContextClient = `
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

  async function contextForResolution(resolution, requestId, domTarget) {
    const controller = new AbortController();
    if (state.requestId === requestId) state.contextAbortController = controller;
    if (resolution.confidence === "high" || resolution.module) {
      try {
        const parameters = new URLSearchParams({ id: resolution.selectionId });
        if (resolution.module) parameters.set("module", resolution.module);
        parameters.set("dom", domSnapshot(domTarget || state.pinnedTarget));
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
`;

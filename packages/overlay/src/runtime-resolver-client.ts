export const runtimeResolverClient = `
  function fiberName(fiber) {
    if (!fiber) return null;
    return displayNameFromTarget(fiber.elementType || fiber.type, 0);
  }

  function displayNameFromTarget(target, depth) {
    if (typeof target === "string") return null;
    if (typeof target === "function") return target.displayName || target.name || null;
    if (!target || typeof target !== "object") return null;
    const displayName = nonEmptyString(target.displayName) || nonEmptyString(target.name);
    if (displayName || depth >= 3) return displayName || null;
    return displayNameFromTarget(target.render, depth + 1) || displayNameFromTarget(target.type, depth + 1);
  }

  function nonEmptyString(value) {
    return typeof value === "string" && value.length > 0 ? value : null;
  }

  function ownerChainFromFiber(fiber) {
    const names = [];
    let current = fiber;
    while (current) {
      const name = fiberName(current);
      if (name && !names.includes(name)) names.push(name);
      current = current.return || null;
    }
    return names;
  }

  function reactFiber(element) {
    const key = Object.getOwnPropertyNames(element).find((item) => item.startsWith("__reactFiber$") || item.startsWith("__reactInternalInstance$"));
    return key ? element[key] : null;
  }

  function moduleHintFromFiber(fiber) {
    let current = fiber;
    while (current) {
      const source = current._debugSource;
      const hint = source && safeModuleHint(source.fileName);
      if (hint) return hint;
      current = current.return || null;
    }
    return null;
  }

  function safeModuleHint(value) {
    if (typeof value !== "string") return null;
    const clean = value.split("?")[0].replace(/\\\\/g, "/");
    if (!clean || clean.includes("\\0") || /^[a-z][a-z0-9+.-]*:/i.test(clean)) return null;
    if (!/\\.[cm]?[jt]sx?$/.test(clean)) return null;
    const segments = clean.split("/").filter(Boolean);
    if (segments.some((segment) => segment === "." || segment === ".." || segment === "node_modules")) return null;
    if (clean.startsWith("/@fs/") || clean.startsWith("/src/")) return clean;
    return clean.startsWith("/") ? "/@fs" + clean : clean;
  }

  function generatedSelectionId(moduleHint, ownerChain) {
    const input = moduleHint + "|" + ownerChain.join("|");
    let hash = 2166136261;
    for (let index = 0; index < input.length; index += 1) {
      hash ^= input.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return "fallback-" + (hash >>> 0).toString(36).padStart(7, "0");
  }

  function resolveElement(element) {
    const metadataElement = element.closest ? element.closest(sourceSelector) : null;
    const selectionId = metadataElement ? metadataElement.getAttribute("data-pickfix-id") : null;
    if (selectionId) return { confidence: "high", ownerChain: [], reason: "Source metadata", selectionId };
    const fiber = reactFiber(element);
    const chain = ownerChainFromFiber(fiber);
    const moduleHint = moduleHintFromFiber(fiber);
    if (moduleHint) return { confidence: chain.length > 0 ? "medium" : "low", module: moduleHint, ownerChain: chain, reason: "React source fallback", selectionId: generatedSelectionId(moduleHint, chain) };
    if (chain.length > 0) return { confidence: "medium", ownerChain: chain, reason: "React owner chain fallback" };
    return { confidence: "low", ownerChain: [], reason: "No source metadata or React owner chain was available" };
  }
`;

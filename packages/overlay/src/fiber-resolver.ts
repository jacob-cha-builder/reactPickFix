export type RuntimeResolveConfidence = "high" | "medium" | "low";

export type RuntimeElementResolution =
  | {
      readonly confidence: "high";
      readonly ownerChain: readonly string[];
      readonly reason: "Source metadata";
      readonly selectionId: string;
    }
  | {
      readonly confidence: "medium" | "low";
      readonly ownerChain: readonly string[];
      readonly reason: string;
    };

export type PickfixResolvableElement = {
  readonly parentElement: PickfixResolvableElement | null;
  readonly getAttribute: (name: string) => string | null;
};

type FiberLike = {
  readonly elementType?: unknown;
  readonly return?: unknown;
  readonly type?: unknown;
};

export function resolveElementMetadata(element: PickfixResolvableElement): RuntimeElementResolution {
  const metadataElement = findMetadataElement(element);
  const selectionId = metadataElement?.getAttribute("data-pickfix-id") ?? null;
  if (selectionId !== null && selectionId.length > 0) {
    return {
      confidence: "high",
      ownerChain: [],
      reason: "Source metadata",
      selectionId,
    };
  }

  const ownerChain = collectOwnerChain(element);
  if (ownerChain.length > 0) {
    return {
      confidence: "medium",
      ownerChain,
      reason: "React owner chain fallback",
    };
  }

  return {
    confidence: "low",
    ownerChain: [],
    reason: "No source metadata or React owner chain was available",
  };
}

function findMetadataElement(element: PickfixResolvableElement): PickfixResolvableElement | undefined {
  let current: PickfixResolvableElement | null = element;
  while (current !== null) {
    const selectionId = current.getAttribute("data-pickfix-id");
    if (selectionId !== null && selectionId.length > 0) {
      return current;
    }
    current = current.parentElement;
  }

  return undefined;
}

function collectOwnerChain(element: PickfixResolvableElement): readonly string[] {
  const fiber = findReactFiber(element);
  const names: string[] = [];
  let current: unknown = fiber;

  while (isFiberLike(current)) {
    const name = getFiberDisplayName(current);
    if (name !== undefined && !names.includes(name)) {
      names.push(name);
    }
    current = current.return;
  }

  return names;
}

function findReactFiber(element: PickfixResolvableElement): unknown {
  for (const key of Object.getOwnPropertyNames(element)) {
    if (key.startsWith("__reactFiber$") || key.startsWith("__reactInternalInstance$")) {
      return Reflect.get(element, key);
    }
  }

  return undefined;
}

function getFiberDisplayName(fiber: FiberLike): string | undefined {
  const target = fiber.elementType ?? fiber.type;
  return displayNameFromTarget(target, 0);
}

function displayNameFromTarget(target: unknown, depth: number): string | undefined {
  if (typeof target === "string") {
    return undefined;
  }
  if (typeof target === "function") {
    const displayName = Reflect.get(target, "displayName");
    if (typeof displayName === "string" && displayName.length > 0) {
      return displayName;
    }

    return target.name.length > 0 ? target.name : undefined;
  }
  if (isNamedObject(target)) {
    return namedObjectDisplayName(target, depth);
  }

  return undefined;
}

function namedObjectDisplayName(target: { readonly displayName?: string; readonly name?: string }, depth: number): string | undefined {
  const displayName = nonEmptyString(target.displayName);
  if (displayName !== undefined) {
    return displayName;
  }

  const name = nonEmptyString(target.name);
  if (name !== undefined) {
    return name;
  }

  if (depth >= 3) {
    return undefined;
  }

  return displayNameFromTarget(Reflect.get(target, "render"), depth + 1) ?? displayNameFromTarget(Reflect.get(target, "type"), depth + 1);
}

function nonEmptyString(value: string | undefined): string | undefined {
  return value === undefined || value.length === 0 ? undefined : value;
}

function isFiberLike(value: unknown): value is FiberLike {
  return typeof value === "object" && value !== null;
}

function isNamedObject(value: unknown): value is { readonly displayName?: string; readonly name?: string } {
  return typeof value === "object" && value !== null;
}

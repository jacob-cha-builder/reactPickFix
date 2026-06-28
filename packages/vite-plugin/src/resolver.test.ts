import { join } from "node:path";
import { describe, expect, test } from "vitest";

import { resolveElementMetadata } from "../../overlay/src/fiber-resolver";
import { createSourceMetadataRegistry } from "./metadata-registry";
import { resolveLowConfidenceContext } from "./source-resolver";
import { transformSourceMetadata } from "./source-metadata";

type TestElement = {
  readonly parentElement: TestElement | null;
  readonly getAttribute: (name: string) => string | null;
};

describe("metadata resolver", () => {
  test("metadata resolver handles high medium low confidence", () => {
    // Given: authored TSX under the project root with nested, repeated, and portal JSX.
    const root = "/workspace/app";
    const file = join(root, "src", "App.tsx");
    const registry = createSourceMetadataRegistry({ root });
    const source = `
      import { createPortal } from "react-dom";

      function FunctionFixture() {
        return <section data-testid="function-component"><button>Action</button></section>;
      }

      export function App() {
        function NestedFixture() {
          return <section data-testid="nested-component"><button>Nested</button></section>;
        }

        const items = ["Alpha", "Beta"];

        return (
          <main>
            <FunctionFixture />
            <NestedFixture />
            <ul>{items.map((item) => <li key={item}><span>{item}</span></li>)}</ul>
            {createPortal(<div role="dialog"><button>Close</button></div>, document.body)}
          </main>
        );
      }
    `;

    // When: the metadata transform runs twice for the same module and then fallback paths resolve DOM-like inputs.
    const firstTransform = transformSourceMetadata({ code: source, id: file, registry, root });
    const secondTransform = transformSourceMetadata({ code: source, id: file, registry, root });
    const functionId = findMetadataId(firstTransform?.code ?? "", "function-component");
    const nestedId = findMetadataId(firstTransform?.code ?? "", "nested-component");
    const portalId = findMetadataId(firstTransform?.code ?? "", "dialog");
    const repeatedIds = collectMetadataIds(firstTransform?.code ?? "", "li");
    transformSourceMetadata({ code: source, id: file, registry, root });
    const collidingRegistry = createSourceMetadataRegistry({ root });
    const firstCollisionId = collidingRegistry.register({
      column: 4,
      componentName: "FirstCollision",
      file,
      id: "collision01",
      line: 12,
    });
    const secondCollisionId = collidingRegistry.register({
      column: 4,
      componentName: "SecondCollision",
      file,
      id: "collision01",
      line: 12,
    });
    const mediumFallback = resolveElementMetadata(
      makeElement(
        {},
        null,
        makeFiberChain(["button", "PortalModalFixture", "App"]),
      ),
    );
    const lowFallback = resolveLowConfidenceContext({
      moduleId: "/@fs/workspace/app/src/generated.js",
      root,
      selectionId: "fallback01",
    });

    // Then: source ids map to authored components, duplicate ids are regenerated, and each fallback states confidence.
    expect(firstTransform?.code).toContain("data-pickfix-id");
    expect(functionId).toMatch(/^[a-z0-9_-]{8,96}$/i);
    expect(nestedId).toMatch(/^[a-z0-9_-]{8,96}$/i);
    expect(portalId).toMatch(/^[a-z0-9_-]{8,96}$/i);
    expect(repeatedIds).toHaveLength(1);
    expect(firstCollisionId).toBe("collision01");
    expect(secondCollisionId).toBe("collision01-2");
    expect(collidingRegistry.resolveById(firstCollisionId)).toMatchObject({
      source: {
        componentName: "FirstCollision",
      },
    });
    expect(collidingRegistry.resolveById(secondCollisionId)).toMatchObject({
      source: {
        componentName: "SecondCollision",
      },
    });

    expect(registry.resolveById(functionId)).toMatchObject({
      confidence: "high",
      source: {
        componentName: "FunctionFixture",
        file: "src/App.tsx",
      },
    });
    expect(registry.resolveById(nestedId)).toMatchObject({
      confidence: "high",
      source: {
        componentName: "NestedFixture",
        file: "src/App.tsx",
      },
    });
    expect(registry.resolveById(portalId)).toMatchObject({
      confidence: "high",
      source: {
        componentName: "App",
        file: "src/App.tsx",
      },
    });

    expect(mediumFallback).toEqual({
      confidence: "medium",
      ownerChain: ["PortalModalFixture", "App"],
      reason: "React owner chain fallback",
    });
    expect(lowFallback).toMatchObject({
      confidence: "low",
      ownerChain: [],
      source: {
        componentName: "Unmapped source",
        file: "src/generated.js",
      },
    });

    registry.invalidateFile(file);
    expect(registry.resolveById(functionId)).toBeUndefined();
  });

  test("metadata resolver labels memo and forwardRef wrappers without moving source ownership", () => {
    // Given: React wrapper components whose rendered JSX lives inside wrapper render functions.
    const root = "/workspace/app";
    const file = join(root, "src", "Wrapped.tsx");
    const registry = createSourceMetadataRegistry({ root });
    const source = `
      import { forwardRef, memo } from "react";

      const MemoCard = memo(() => {
        return <section data-testid="memo-card">Memo</section>;
      });

      const ForwardCard = forwardRef(function ForwardInner(_props, _ref) {
        return <section data-testid="forward-card">Forward</section>;
      });

      const DisplayWrapped = memo(function HiddenInner() {
        return <section data-testid="display-card">Display</section>;
      });
      DisplayWrapped.displayName = "DisplayLabel";
    `;

    // When: source metadata is transformed and selected JSX ids are resolved.
    const transformed = transformSourceMetadata({ code: source, id: file, registry, root });
    const memoId = findMetadataId(transformed?.code ?? "", "memo-card");
    const forwardId = findMetadataId(transformed?.code ?? "", "forward-card");
    const displayId = findMetadataId(transformed?.code ?? "", "display-card");

    // Then: labels unwrap wrapper names/display names while source ownership remains at the selected file.
    expect(registry.resolveById(memoId)).toMatchObject({
      source: {
        componentName: "MemoCard",
        file: "src/Wrapped.tsx",
      },
    });
    expect(registry.resolveById(forwardId)).toMatchObject({
      source: {
        componentName: "ForwardInner",
        file: "src/Wrapped.tsx",
      },
    });
    expect(registry.resolveById(displayId)).toMatchObject({
      source: {
        componentName: "DisplayLabel",
        file: "src/Wrapped.tsx",
      },
    });
  });

  test("runtime resolver unwraps memo and forwardRef labels without source metadata", () => {
    // Given: React-like memo and forwardRef fiber targets without pickfix source attributes.
    function MemoInner(): null {
      return null;
    }
    function ForwardInner(): null {
      return null;
    }
    const memoTarget = { type: MemoInner };
    const forwardTarget = { render: ForwardInner };
    const fiber = {
      elementType: memoTarget,
      return: {
        elementType: forwardTarget,
        return: null,
        type: forwardTarget,
      },
      type: memoTarget,
    };

    // When: runtime metadata falls back to the React owner chain.
    const fallback = resolveElementMetadata(makeElement({}, null, fiber));

    // Then: labels come from unwrapped memo/forwardRef targets and no source id is invented.
    expect(fallback).toEqual({
      confidence: "medium",
      ownerChain: ["MemoInner", "ForwardInner"],
      reason: "React owner chain fallback",
    });
  });
});

function findMetadataId(code: string, nearbyText: string): string {
  const nearbyIndex = code.indexOf(nearbyText);
  expect(nearbyIndex).toBeGreaterThanOrEqual(0);
  const openingStart = code.lastIndexOf("<", nearbyIndex);
  const openingEnd = code.indexOf(">", nearbyIndex);
  expect(openingStart).toBeGreaterThanOrEqual(0);
  expect(openingEnd).toBeGreaterThanOrEqual(0);
  const openingTag = code.slice(openingStart, openingEnd);
  const id = collectPickfixIds(openingTag)[0];
  expect(id).toBeDefined();
  return id ?? "";
}

function collectMetadataIds(code: string, tagName: string): readonly string[] {
  const pattern = new RegExp(`<${tagName}[^>]*data-pickfix-id="([^"]+)"`, "g");
  return [...code.matchAll(pattern)].map((match) => match[1] ?? "");
}

function collectPickfixIds(code: string): readonly string[] {
  return [...code.matchAll(/data-pickfix-id="([^"]+)"/g)].map((match) => match[1] ?? "");
}

function makeElement(attributes: Readonly<Record<string, string>>, parentElement: TestElement | null, fiber: unknown): TestElement {
  const element: TestElement = {
    getAttribute(name: string): string | null {
      return attributes[name] ?? null;
    },
    parentElement,
  };

  Object.defineProperty(element, "__reactFiber$pickfix", {
    configurable: true,
    enumerable: true,
    value: fiber,
  });

  return element;
}

function makeFiberChain(names: readonly string[]): unknown {
  let current: unknown = null;

  for (const name of [...names].reverse()) {
    const target = name.toLowerCase() === name ? name : { displayName: name };
    current = {
      elementType: target,
      return: current,
      type: target,
    };
  }

  return current;
}

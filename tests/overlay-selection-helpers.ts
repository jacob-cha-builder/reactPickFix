import { expect, type Locator, type Page } from "@playwright/test";

export type FixtureCase = {
  readonly confidence: "high" | "low";
  readonly name: string;
  readonly reason: string;
  readonly source: string;
  readonly target: (page: Page) => Locator;
};

export const viewportWidths = [375, 768, 1280] as const;
export const delayedDismissActions = ["reset", "close", "escape"] as const;

export type DelayedDismissAction = (typeof delayedDismissActions)[number];

export type Deferred = {
  readonly promise: Promise<void>;
  readonly resolve: () => void;
};

export const fixtureCases: readonly FixtureCase[] = [
  {
    confidence: "high",
    name: "FunctionFixture",
    reason: "Matched component source",
    source: "src/App.tsx",
    target: (page) => page.getByTestId("function-component"),
  },
  {
    confidence: "high",
    name: "ImportedFixture",
    reason: "Matched component source",
    source: "src/ImportedFixture.tsx",
    target: (page) => page.getByTestId("imported-component"),
  },
  {
    confidence: "high",
    name: "CssModuleFixture",
    reason: "Matched component source",
    source: "src/CssModuleFixture.tsx",
    target: (page) => page.getByTestId("css-module-component"),
  },
  {
    confidence: "high",
    name: "PortalModalFixture",
    reason: "Matched component source",
    source: "src/App.tsx",
    target: (page) => page.getByTestId("portal-modal-component"),
  },
  {
    confidence: "high",
    name: "RepeatedListFixture",
    reason: "Matched component source",
    source: "src/App.tsx",
    target: (page) => page.getByTestId("repeated-list-item").nth(1),
  },
  {
    confidence: "low",
    name: "Unmapped element",
    reason: "Could not match this element to source",
    source: "No source metadata",
    target: (page) => page.locator(".plain-dom-fixture"),
  },
];

export async function activateOverlayIfPresent(page: Page): Promise<void> {
  const toggle = page.locator("[data-pickfix-toggle]");
  if ((await toggle.count()) === 0) {
    return;
  }

  if ((await toggle.getAttribute("aria-pressed")) !== "true") {
    await toggle.click();
  }
}

export async function deactivateOverlayIfActive(page: Page): Promise<void> {
  const toggle = page.locator("[data-pickfix-toggle]");
  if ((await toggle.count()) === 0) {
    return;
  }

  if ((await toggle.getAttribute("aria-pressed")) === "true") {
    await toggle.click();
  }
}

export function functionFixtureCase(): FixtureCase {
  return {
    confidence: "high",
    name: "FunctionFixture",
    reason: "Matched component source",
    source: "src/App.tsx",
    target: (page) => page.getByTestId("function-component"),
  };
}

export function fallbackFixtureCase(): FixtureCase {
  return {
    confidence: "low",
    name: "Unmapped element",
    reason: "Could not match this element to source",
    source: "No source metadata",
    target: (page) => page.locator(".plain-dom-fixture"),
  };
}

export function createDeferred(): Deferred {
  let resolveDeferred = (): void => {};
  const promise = new Promise<void>((resolve) => {
    resolveDeferred = resolve;
  });

  return { promise, resolve: resolveDeferred };
}

export function createDelayedContext(selectionId: string): object {
  return {
    confidence: "high",
    domSnapshot: "",
    excerpt: "",
    imports: [],
    limits: {
      domBytes: 0,
      domNodes: 0,
      excerptBytes: 0,
      excerptLines: 0,
    },
    ok: true,
    ownerChain: [],
    packageScripts: [],
    selectionId,
    source: {
      column: 1,
      componentName: "FunctionFixture",
      file: "src/App.tsx",
      id: selectionId,
      line: 1,
    },
    styles: [],
  };
}

export async function dismissSelection(page: Page, action: DelayedDismissAction): Promise<void> {
  if (action === "reset") {
    await page.locator("[data-pickfix-reset]").click();
    return;
  }

  if (action === "close") {
    await page.locator("[data-pickfix-close]").click();
    return;
  }

  await page.keyboard.press("Escape");
}

export async function installHostActionCounter(page: Page): Promise<void> {
  await page.evaluate(() => {
    document.body.dataset["hostActionCount"] = "0";
    const button = document.querySelector("[data-testid='function-component'] button");
    if (button === null) {
      throw new Error("Function component action button was not found");
    }
    button.addEventListener("click", () => {
      const currentCount = Number(document.body.dataset["hostActionCount"] ?? "0");
      document.body.dataset["hostActionCount"] = String(currentCount + 1);
    });
  });
}

export async function expectPanelSummary(page: Page, fixture: FixtureCase): Promise<void> {
  const panel = page.locator("[data-pickfix-panel]");
  await expect(panel).toBeVisible();
  await expect(panel.locator("[data-pickfix-component-name]")).toHaveText(fixture.name);
  await expect(panel.locator("[data-pickfix-source-location]")).toContainText(fixture.source);
  await expect(panel.locator("[data-pickfix-confidence]")).toContainText(fixture.confidence);
  await expect(panel.locator("[data-pickfix-reason]")).toHaveText(fixture.reason);
  await expect(panel.locator("[data-pickfix-reason]")).not.toContainText(/Source metadata|React owner chain fallback/);
}

export async function expectPanelWithinViewport(page: Page): Promise<void> {
  const fits = await page.locator("[data-pickfix-panel]").evaluate((panel) => {
    const box = panel.getBoundingClientRect();
    const viewportWidth = document.documentElement.clientWidth;
    const viewportHeight = document.documentElement.clientHeight;
    const visible = box.left >= 0 && box.top >= 0 && box.right <= viewportWidth && box.bottom <= viewportHeight;
    const contentFits = panel.scrollWidth <= panel.clientWidth;
    const documentFits = document.documentElement.scrollWidth <= viewportWidth;
    return visible && contentFits && documentFits;
  });

  expect(fits).toBe(true);
}

export async function waitForStablePanel(page: Page): Promise<void> {
  await page.locator("[data-pickfix-panel]").evaluate(async (panel) => {
    const animations = panel.getAnimations({ subtree: true });
    await Promise.all(animations.map((animation) => animation.finished.catch(() => undefined)));
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => resolve());
      });
    });
  });
}

import { expect, test } from "@playwright/test";

type RuntimeElementResolution =
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

declare global {
  interface Window {
    readonly __pickfixResolveElement: (element: Element) => RuntimeElementResolution;
  }
}

test.describe("metadata resolver browser surface", () => {
  test("resolves high confidence metadata and low confidence fallback", async ({ page }) => {
    // Given: the fixture app is served by Vite with the pickfix plugin active.
    await page.goto("/");
    const functionComponent = page.getByTestId("function-component");

    // When: an authored DOM element and a detached element are resolved through the runtime surface.
    const selectionId = await functionComponent.evaluate((element) => element.getAttribute("data-pickfix-id"));
    expect(selectionId).toMatch(/^[a-z0-9_-]{8,96}$/i);

    const contextResponse = await page.request.get(`/__pickfix/context?id=${selectionId}`);
    const context = await contextResponse.json();
    const fallback = await page.evaluate(() => {
      const detached = document.createElement("div");
      return window.__pickfixResolveElement(detached);
    });

    // Then: the endpoint maps metadata to source and the browser fallback reports low confidence when unmappable.
    expect(contextResponse.status()).toBe(200);
    expect(context).toMatchObject({
      confidence: "high",
      ok: true,
      source: {
        componentName: "FunctionFixture",
        file: "src/App.tsx",
      },
    });
    expect(fallback).toEqual({
      confidence: "low",
      ownerChain: [],
      reason: "No source metadata or React owner chain was available",
    });
  });
});

import { expect, test } from "@playwright/test";

import {
  activateOverlayIfPresent,
  deactivateOverlayIfActive,
  expectPanelSummary,
  expectPanelWithinViewport,
  fixtureCases,
  viewportWidths,
  waitForStablePanel,
} from "./overlay-selection-helpers";

test.describe("overlay selection UI", () => {
  test("does not ship fixture-only fallback selectors", async ({ page }) => {
    // Given: the dev server serves the overlay client.
    const response = await page.request.get("/__pickfix/client.js");

    // When/Then: production selection does not depend on the fixture-only plain DOM test id.
    expect(response.status()).toBe(200);
    expect(await response.text()).not.toContain("plain-dom-node");
  });

  for (const width of viewportWidths) {
    test(`selects fixture components without panel overflow at ${width}px`, async ({ page }) => {
      // Given: the fixture app is running with the pickfix overlay client injected.
      await page.setViewportSize({ height: 900, width });
      await page.goto("/");
      await activateOverlayIfPresent(page);

      // When/Then: every fixture case can be pinned and summarized in the inspector.
      for (const fixture of fixtureCases) {
        if (fixture.name === "PortalModalFixture") {
          await deactivateOverlayIfActive(page);
          await page.getByRole("button", { name: "Open portal modal" }).click();
          await activateOverlayIfPresent(page);
        }

        await fixture.target(page).hover();
        await expect(page.locator("[data-pickfix-hover-outline]")).toBeVisible();

        await fixture.target(page).click();
        await expectPanelSummary(page, fixture);
        await expectPanelWithinViewport(page);
        if (fixture.name === "FunctionFixture") {
          await waitForStablePanel(page);
          await page.screenshot({ path: `.omo/evidence/component-prompt-editor/browser/task-7/overlay-${width}.png` });
        }

        await page.locator("[data-pickfix-reset]").click();
        await expect(page.locator("[data-pickfix-panel]")).toBeHidden();
        await page.keyboard.press("Escape");

        if (fixture.name === "PortalModalFixture") {
          await deactivateOverlayIfActive(page);
          await page.getByRole("button", { name: "Close portal modal" }).click();
          await activateOverlayIfPresent(page);
        }
      }
    });
  }
});

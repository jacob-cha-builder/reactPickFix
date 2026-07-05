import { expect, test, type Locator, type Page } from "@playwright/test";

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
        await expect(page.getByText("Codex command examples")).toHaveCount(0);
        await expectFontSizeToMatchTextEditAvailability(page);
        await expect(page.getByLabel("Left / right")).toBeVisible();
        await expect(page.getByLabel("Up / down")).toBeVisible();
        await expect(page.getByRole("button", { name: "Copy prompt" })).toBeVisible();
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

  test("shows the clicked Select Alpha button as the pinned visual target", async ({ page }) => {
    await page.setViewportSize({ height: 900, width: 1280 });
    await page.goto("/");
    await activateOverlayIfPresent(page);

    const alphaButton = page.getByTestId("repeated-list-item").nth(0).getByRole("button", { name: "Select Alpha" });
    await alphaButton.scrollIntoViewIfNeeded();
    await alphaButton.click();

    await expect(page.locator("[data-pickfix-component-name]")).toHaveText("RepeatedListFixture");
    await expect.poll(() => pinnedOutlineMatchesButton(page, "Select Alpha")).toBe(true);
  });

  test("shows a hand cursor over selectable targets while selection mode is active", async ({ page }) => {
    await page.setViewportSize({ height: 900, width: 1280 });
    await page.goto("/");

    const heading = page.getByTestId("function-component").getByRole("heading", { name: "Function component" });
    await expect.poll(() => cursorFor(heading)).not.toBe("pointer");

    await activateOverlayIfPresent(page);
    await heading.hover();

    await expect(page.locator("[data-pickfix-hover-outline]")).toBeVisible();
    await expect.poll(() => cursorFor(heading)).toBe("pointer");

    await deactivateOverlayIfActive(page);
    await expect.poll(() => cursorFor(heading)).not.toBe("pointer");
  });

  test("keeps the selected component highlighted and opens an anchored popover near it", async ({ page }) => {
    await page.setViewportSize({ height: 900, width: 1280 });
    await page.goto("/");
    await activateOverlayIfPresent(page);

    const target = page.getByTestId("function-component");
    await target.click();
    await expect.poll(() => pinnedOutlineMatchesTestId(page, "function-component")).toBe(true);
    await expect.poll(() => panelIsAnchoredNearTestId(page, "function-component")).toBe(true);

    await page.getByLabel("Comment").fill("First note.");
    await page.getByRole("button", { name: "Comment" }).click();

    await expect.poll(() => pinnedOutlineMatchesTestId(page, "function-component")).toBe(true);
    await page.getByTestId("css-module-component").locator("button").click();

    await expect(page.locator("[data-pickfix-component-name]")).toHaveText("CssModuleFixture");
  });
});

async function pinnedOutlineMatchesButton(page: Page, buttonText: string): Promise<boolean> {
  return page.evaluate((text) => {
    const button = [...document.querySelectorAll("button")].find((element) => element.textContent?.trim() === text);
    const outline = document.querySelector("[data-pickfix-pinned-outline]");
    if (!(button instanceof HTMLElement) || !(outline instanceof HTMLElement) || outline.hidden) return false;
    const buttonBox = button.getBoundingClientRect();
    const outlineBox = outline.getBoundingClientRect();
    return (
      Math.abs(outlineBox.left - (buttonBox.left - 2)) <= 1 &&
      Math.abs(outlineBox.top - (buttonBox.top - 2)) <= 1 &&
      Math.abs(outlineBox.width - (buttonBox.width + 4)) <= 1 &&
      Math.abs(outlineBox.height - (buttonBox.height + 4)) <= 1
    );
  }, buttonText);
}

async function pinnedOutlineMatchesTestId(page: Page, testId: string): Promise<boolean> {
  return page.evaluate((id) => {
    const target = document.querySelector(`[data-testid='${id}']`);
    const outline = document.querySelector("[data-pickfix-pinned-outline]");
    if (!(target instanceof HTMLElement) || !(outline instanceof HTMLElement) || outline.hidden) return false;
    const targetBox = target.getBoundingClientRect();
    const outlineBox = outline.getBoundingClientRect();
    return (
      Math.abs(outlineBox.left - (targetBox.left - 2)) <= 1 &&
      Math.abs(outlineBox.top - (targetBox.top - 2)) <= 1 &&
      Math.abs(outlineBox.width - (targetBox.width + 4)) <= 1 &&
      Math.abs(outlineBox.height - (targetBox.height + 4)) <= 1
    );
  }, testId);
}

async function cursorFor(locator: Locator): Promise<string> {
  return locator.evaluate((element) => window.getComputedStyle(element).cursor);
}

async function expectFontSizeToMatchTextEditAvailability(page: Page): Promise<void> {
  if (await page.getByLabel("Text 수정").isVisible()) {
    await expect(page.getByLabel("Font size")).toBeVisible();
  } else {
    await expect(page.getByLabel("Font size")).toBeHidden();
  }
}

async function panelIsAnchoredNearTestId(page: Page, testId: string): Promise<boolean> {
  return page.evaluate((id) => {
    const target = document.querySelector(`[data-testid='${id}']`);
    const panel = document.querySelector("[data-pickfix-panel]");
    if (!(target instanceof HTMLElement) || !(panel instanceof HTMLElement) || panel.hidden) return false;
    const targetBox = target.getBoundingClientRect();
    const box = panel.getBoundingClientRect();
    const sideAnchored = (box.left >= targetBox.right + 6 || box.right <= targetBox.left - 6) && box.bottom >= targetBox.top && box.top <= targetBox.bottom;
    const verticalAnchored = (box.top >= targetBox.bottom + 6 || box.bottom <= targetBox.top - 6) && box.right >= targetBox.left && box.left <= targetBox.right;
    const overlapsTarget = !(box.right < targetBox.left || box.left > targetBox.right || box.bottom < targetBox.top || box.top > targetBox.bottom);
    const viewportClamped = box.left >= 0 && box.right <= window.innerWidth && box.top >= 0 && box.bottom <= window.innerHeight;
    return (sideAnchored || verticalAnchored) && !overlapsTarget && viewportClamped;
  }, testId);
}

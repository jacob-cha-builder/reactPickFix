import { expect, test } from "@playwright/test";

import {
  fillComposer,
  selectFunctionFixture,
  selectImportedFixture,
} from "./handoff-helpers";

import {
  activateOverlayIfPresent,
  createDelayedContext,
  createDeferred,
  delayedDismissActions,
  deactivateOverlayIfActive,
  dismissSelection,
  expectPanelSummary,
  fallbackFixtureCase,
  functionFixtureCase,
  installHostActionCounter,
} from "./overlay-selection-helpers";

test.describe("overlay selection state controls", () => {
  test("supports keyboard pin and escape reset", async ({ page }) => {
    // Given: selection mode is active on the fixture page.
    await page.goto("/");
    await activateOverlayIfPresent(page);
    await page.getByTestId("function-component").focus();

    // When: the focused target is pinned with Enter and then cleared with Escape.
    await page.keyboard.press("Enter");
    await expectPanelSummary(page, functionFixtureCase());

    await page.keyboard.press("Escape");

    // Then: the selection panel closes and the toggle remains available.
    await expect(page.locator("[data-pickfix-panel]")).toBeHidden();
    await expect(page.locator("[data-pickfix-toggle]")).toBeVisible();
  });

  test("blocks host click actions while selection mode is active", async ({ page }) => {
    // Given: the host page has a real button action and selection mode is active.
    await page.goto("/");
    await installHostActionCounter(page);
    await activateOverlayIfPresent(page);

    // When: the host button is clicked as an overlay target.
    await page.getByRole("button", { name: "Function component action" }).click();

    // Then: the selection panel opens, but the host button action does not run.
    await expectPanelSummary(page, functionFixtureCase());
    await expect(page.locator("body")).toHaveAttribute("data-host-action-count", "0");
  });

  test("restores tabindex values added during activation", async ({ page }) => {
    // Given: one host target has no tabindex and another already owns a tabindex value.
    await page.goto("/");
    const functionComponent = page.getByTestId("function-component");
    const importedComponent = page.getByTestId("imported-component");
    await expect(functionComponent).not.toHaveAttribute("tabindex", /.+/);
    await importedComponent.evaluate((element) => {
      element.setAttribute("tabindex", "7");
    });

    // When: selection mode activates and then deactivates.
    await activateOverlayIfPresent(page);
    await expect(functionComponent).toHaveAttribute("tabindex", "0");
    await expect(importedComponent).toHaveAttribute("tabindex", "7");
    await deactivateOverlayIfActive(page);

    // Then: only the overlay-added tabindex is removed.
    await expect(functionComponent).not.toHaveAttribute("tabindex", /.+/);
    await expect(importedComponent).toHaveAttribute("tabindex", "7");
  });

  test("resets draft composer state but keeps saved comments when a new component is selected", async ({ context, page }) => {
    await context.clearPermissions();
    await page.goto("/");
    await selectFunctionFixture(page);
    await fillComposer(page);
    await page.getByRole("button", { name: "Comment" }).click();
    await expect(page.locator("[data-pickfix-comment-list]")).toContainText("1.");
    await expect(page.locator("[data-pickfix-comment-marker]")).toHaveCount(1);
    await page.getByRole("button", { name: "Copy prompt" }).click();
    await expect(page.locator("[data-pickfix-prompt-output]")).toHaveValue(/FunctionFixture/);
    await expect(page.locator("[data-pickfix-prompt-status]")).not.toHaveText("");
    const fallback = page.locator("[data-pickfix-clipboard-fallback]");
    await expect(fallback).toBeVisible();
    await expect(fallback).toHaveValue(/FunctionFixture/);
    await expect(page.locator("[data-pickfix-prompt-status]")).toContainText("Clipboard blocked");

    // When: the user selects a different component.
    await selectImportedFixture(page);

    await expect(page.locator("[data-pickfix-component-name]")).toHaveText("ImportedFixture");
    await expect(page.locator("[data-pickfix-intent-text]")).toHaveValue("");
    await expect(page.locator("[data-pickfix-intent-size]")).toHaveValue("0");
    await expect(page.locator("[data-pickfix-intent-position-x]")).toHaveValue("0");
    await expect(page.locator("[data-pickfix-intent-position-y]")).toHaveValue("0");
    await expect(page.locator("[data-pickfix-prompt-output]")).toHaveValue("");
    await expect(page.locator("[data-pickfix-prompt-status]")).toHaveText("");
    await expect(page.locator("[data-pickfix-clipboard-fallback-region]")).toBeHidden();
    await expect(fallback).toHaveValue("");
    await expect(page.locator("[data-pickfix-comment-list]")).toContainText("1.");
    await expect(page.locator("[data-pickfix-comment-marker]")).toHaveText(["1"]);
  });

  for (const action of delayedDismissActions) {
    test(`ignores delayed context after ${action}`, async ({ page }) => {
      // Given: a stale high-confidence context request is in flight while a previous fallback panel is visible.
      await page.goto("/");
      await activateOverlayIfPresent(page);
      await page.locator(".plain-dom-fixture").click();
      await expectPanelSummary(page, fallbackFixtureCase());

      const requested = createDeferred();
      const release = createDeferred();
      await page.route("**/__pickfix/context?id=**", async (route) => {
        requested.resolve();
        await release.promise;
        const selectionId = new URL(route.request().url()).searchParams.get("id") ?? "stale-selection";
        await route.fulfill({
          body: JSON.stringify(createDelayedContext(selectionId)),
          contentType: "application/json",
          status: 200,
        });
      });

      await page.getByTestId("function-component").click();
      await requested.promise;

      // When: the user dismisses the panel before the request resolves.
      await dismissSelection(page, action);
      await expect(page.locator("[data-pickfix-panel]")).toBeHidden();
      release.resolve();

      // Then: the late response is ignored and the panel does not reopen.
      await expect(page.locator("[data-pickfix-panel]")).toBeHidden();
      await page.unroute("**/__pickfix/context?id=**");
    });
  }
});

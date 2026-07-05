import { expect, test } from "@playwright/test";

import {
  clickImportedFixtureWithoutWaiting,
  expectHandoffText,
  fillComposer,
  installNeutralizationFailureClipboardProbe,
  installPendingClipboardProbe,
  readClipboard,
  rejectPendingClipboardWrite,
  resolvePendingClipboardWrite,
  selectFunctionFixture,
  settleBrowserWork,
  waitForPendingClipboardWrite,
} from "./handoff-helpers";

test.describe("clipboard handoff pending selection locks", () => {
  test("keeps prompt fallback aligned with the locked selection while copy is pending", async ({ page }) => {
    // Given: FunctionFixture is selected and clipboard writes stay pending after the prompt is generated.
    await page.goto("/");
    await selectFunctionFixture(page);
    await fillComposer(page);
    await installPendingClipboardProbe(page);

    // When: a FunctionFixture copy reaches clipboard write, then the user clicks ImportedFixture before denial rejects it.
    await page.getByRole("button", { name: "Copy prompt" }).click();
    await waitForPendingClipboardWrite(page);
    await clickImportedFixtureWithoutWaiting(page);
    await expect(page.locator("[data-pickfix-component-name]")).toHaveText("FunctionFixture");
    await rejectPendingClipboardWrite(page);
    await settleBrowserWork(page);

    // Then: the fallback is for the still-visible FunctionFixture selection.
    await expect(page.locator("[data-pickfix-component-name]")).toHaveText("FunctionFixture");
    const clipboardText = await readClipboard(page);
    const outputText = await page.locator("[data-pickfix-prompt-output]").inputValue();
    const fallbackText = await page.locator("[data-pickfix-clipboard-fallback]").inputValue();
    const statusText = await page.locator("[data-pickfix-prompt-status]").textContent();
    expect(clipboardText).toBe("clipboard sentinel");
    expect(outputText).toContain("Component: FunctionFixture");
    expect(outputText).not.toContain("Component: ImportedFixture");
    expectHandoffText(fallbackText, "FunctionFixture");
    expect(statusText).toContain("Clipboard blocked");
    expect(statusText).not.toContain("Prompt copied");
  });

  test("keeps current selection visible when stale-success neutralization would fail", async ({ page }) => {
    // Given: FunctionFixture is selected and its generated prompt has reached a pending clipboard write.
    await page.goto("/");
    await selectFunctionFixture(page);
    await fillComposer(page);
    await installNeutralizationFailureClipboardProbe(page);

    // When: the user clicks ImportedFixture while the FunctionFixture write is pending.
    await page.getByRole("button", { name: "Copy prompt" }).click();
    await waitForPendingClipboardWrite(page);
    await clickImportedFixtureWithoutWaiting(page);
    await expect(page.locator("[data-pickfix-component-name]")).toHaveText("FunctionFixture");
    await resolvePendingClipboardWrite(page);
    await settleBrowserWork(page);

    // Then: the committed FunctionFixture clipboard remains aligned with the visible FunctionFixture panel.
    await expect(page.locator("[data-pickfix-component-name]")).toHaveText("FunctionFixture");
    const clipboardText = await readClipboard(page);
    const outputText = await page.locator("[data-pickfix-prompt-output]").inputValue();
    const fallbackText = await page.locator("[data-pickfix-clipboard-fallback]").inputValue();
    const statusText = await page.locator("[data-pickfix-prompt-status]").textContent();
    expectHandoffText(clipboardText, "FunctionFixture");
    expectHandoffText(outputText, "FunctionFixture");
    expect(fallbackText).not.toContain("FunctionFixture");
    expect(statusText).toContain("Prompt copied");
    expect(statusText).not.toContain("Clipboard blocked");
  });

  test("does not start delayed selection transition while copy is pending", async ({ page }) => {
    // Given: FunctionFixture is selected and its generated prompt is pending at clipboard write.
    await page.goto("/");
    await selectFunctionFixture(page);
    await fillComposer(page);
    await installPendingClipboardProbe(page);

    let importedContextRequested = false;
    await page.route("**/__pickfix/context?id=**", async (route) => {
      importedContextRequested = true;
      const response = await route.fetch();
      await route.fulfill({ response });
    });

    // When: ImportedFixture is clicked before the old clipboard denial settles.
    await page.getByRole("button", { name: "Copy prompt" }).click();
    await waitForPendingClipboardWrite(page);
    await clickImportedFixtureWithoutWaiting(page);
    await rejectPendingClipboardWrite(page);
    await settleBrowserWork(page);

    // Then: no ImportedFixture context request starts and the fallback stays aligned to FunctionFixture.
    await expect(page.locator("[data-pickfix-component-name]")).toHaveText("FunctionFixture");
    const clipboardText = await readClipboard(page);
    const outputText = await page.locator("[data-pickfix-prompt-output]").inputValue();
    const fallbackText = await page.locator("[data-pickfix-clipboard-fallback]").inputValue();
    const statusText = await page.locator("[data-pickfix-prompt-status]").textContent();
    expect(importedContextRequested).toBe(false);
    expect(clipboardText).toBe("clipboard sentinel");
    expect(outputText).toContain("Component: FunctionFixture");
    expect(outputText).not.toContain("Component: ImportedFixture");
    expectHandoffText(fallbackText, "FunctionFixture");
    expect(statusText).toContain("Clipboard blocked");
    expect(statusText).not.toContain("Prompt copied");
  });

  test("keeps copied prompt fallback aligned with the locked selection while copy is pending", async ({ page }) => {
    await page.goto("/");
    await selectFunctionFixture(page);
    await fillComposer(page);
    await installPendingClipboardProbe(page);

    await page.getByRole("button", { name: "Copy prompt" }).click();
    await waitForPendingClipboardWrite(page);
    await clickImportedFixtureWithoutWaiting(page);
    await expect(page.locator("[data-pickfix-component-name]")).toHaveText("FunctionFixture");
    await rejectPendingClipboardWrite(page);
    await settleBrowserWork(page);

    await expect(page.locator("[data-pickfix-component-name]")).toHaveText("FunctionFixture");
    await expect(page.locator("[data-pickfix-source-location]")).toContainText("src/App.tsx");
    await expect(page.locator("[data-pickfix-clipboard-fallback-region]")).toBeVisible();
    const clipboardText = await readClipboard(page);
    const fallbackText = await page.locator("[data-pickfix-clipboard-fallback]").inputValue();
    const statusText = await page.locator("[data-pickfix-prompt-status]").textContent();
    expect(clipboardText).toBe("clipboard sentinel");
    expectHandoffText(fallbackText, "FunctionFixture");
    expect(statusText).toContain("Clipboard blocked");
    expect(statusText).not.toContain("Prompt copied");
  });
});

import { expect, test } from "@playwright/test";

import {
  createDeferred,
  fillComposer,
  readClipboard,
  selectFunctionFixture,
  selectImportedFixture,
  settleBrowserWork,
} from "./handoff-helpers";

test.describe("clipboard handoff stale responses", () => {
  test("ignores stale prompt response after selection changes", async ({ context, page }) => {
    // Given: clipboard access is allowed and a FunctionFixture prompt request is delayed.
    await context.grantPermissions(["clipboard-read", "clipboard-write"], { origin: "http://127.0.0.1:5173" });
    await page.goto("/");
    await selectFunctionFixture(page);
    await fillComposer(page);
    await page.evaluate(() => navigator.clipboard.writeText("clipboard sentinel"));

    const requested = createDeferred();
    const release = createDeferred();
    const routeDone = createDeferred();
    await page.route("**/__pickfix/prompt", async (route) => {
      requested.resolve();
      await release.promise;
      try {
        await route.fulfill({
          body: JSON.stringify({
            ok: true,
            prompt: "Component-scoped change\nComponent: FunctionFixture\nFile: src/App.tsx",
            summary: "Prompt ready",
          }),
          contentType: "application/json",
          status: 200,
        });
      } finally {
        routeDone.resolve();
      }
    });

    // When: a copy starts for FunctionFixture, then the user pins ImportedFixture before the response resolves.
    await page.getByRole("button", { name: "Copy prompt" }).click();
    await requested.promise;
    await selectImportedFixture(page);
    release.resolve();
    await routeDone.promise;
    await settleBrowserWork(page);

    // Then: stale FunctionFixture prompt text is not copied, shown as fallback, or rendered in the output.
    await expect(page.locator("[data-pickfix-component-name]")).toHaveText("ImportedFixture");
    const clipboardText = await readClipboard(page);
    const outputText = await page.locator("[data-pickfix-prompt-output]").inputValue();
    const fallbackText = await page.locator("[data-pickfix-clipboard-fallback]").inputValue();
    expect(clipboardText).not.toContain("FunctionFixture");
    expect(outputText).not.toContain("FunctionFixture");
    expect(fallbackText).not.toContain("FunctionFixture");
  });
});

import { expect, test } from "@playwright/test";

import {
  expectHandoffText,
  fillComposer,
  handoffInstruction,
  selectFunctionFixture,
  selectImportedFixture,
  waitForClipboardText,
} from "./handoff-helpers";

test.describe("clipboard handoff actions", () => {
  test("copies generic prompt Claude prompt and Codex command for the selected component", async ({ context, page }) => {
    // Given: clipboard access is allowed and a component is selected with hostile user notes.
    await context.grantPermissions(["clipboard-read", "clipboard-write"], { origin: "http://127.0.0.1:5173" });
    await page.goto("/");
    await selectFunctionFixture(page);
    await fillComposer(page);

    // When: the generic prompt action copies the endpoint-generated prompt.
    await page.getByRole("button", { name: "Copy prompt" }).click();
    const genericPrompt = await waitForClipboardText(page, "FunctionFixture");

    // Then: the copied prompt is scoped to the selected component and redacted.
    expectHandoffText(genericPrompt, "FunctionFixture");
    expect(genericPrompt).toContain("Component-scoped change");

    // When: the Claude action copies the Claude-targeted endpoint prompt.
    await page.getByRole("button", { name: "Copy Claude prompt" }).click();
    const claudePrompt = await waitForClipboardText(page, "Claude");

    // Then: the copied prompt remains selected-component scoped and Claude-specific.
    expectHandoffText(claudePrompt, "FunctionFixture");
    expect(claudePrompt).toContain("Claude");
    expect(claudePrompt).toContain("verification");

    // When: the Codex command action copies text only.
    await page.getByRole("button", { name: "Copy Codex command" }).click();
    const codexCommand = await waitForClipboardText(page, "Windows PowerShell");

    // Then: the command names the selected component, includes platform examples, and does not execute in-browser.
    expectHandoffText(codexCommand, "FunctionFixture");
    expect(codexCommand).toContain(`macOS: pbpaste | codex exec "${handoffInstruction}"`);
    expect(codexCommand).toContain(`Linux: xclip -selection clipboard -o | codex exec "${handoffInstruction}"`);
    expect(codexCommand).toContain(`Windows PowerShell: Get-Clipboard | codex exec "${handoffInstruction}"`);
  });

  test("clipboard denied fallback exposes manual copy textarea", async ({ context, page }) => {
    // Given: clipboard permissions are denied by the browser context and a component is selected.
    await context.clearPermissions();
    await page.goto("/");
    await selectFunctionFixture(page);
    await fillComposer(page);

    // When: the user clicks a clipboard action.
    await page.getByRole("button", { name: "Copy Claude prompt" }).click();

    // Then: the overlay exposes the exact text in a deterministic manual-copy fallback.
    const fallback = page.locator("[data-pickfix-clipboard-fallback]");
    await expect(fallback).toBeVisible();
    await expect(fallback).toHaveValue(/FunctionFixture/);
    const fallbackText = await fallback.inputValue();
    expectHandoffText(fallbackText, "FunctionFixture");
    await page.getByRole("button", { name: "Dismiss manual copy" }).click();
    await expect(fallback).toBeHidden();
  });

  test("clears settled manual copy fallback when a new selection starts", async ({ context, page }) => {
    // Given: FunctionFixture has a settled clipboard-denied fallback and rendered prompt output.
    await context.clearPermissions();
    await page.goto("/");
    await selectFunctionFixture(page);
    await fillComposer(page);
    await page.getByRole("button", { name: "Copy Claude prompt" }).click();
    const fallback = page.locator("[data-pickfix-clipboard-fallback]");
    await expect(fallback).toBeVisible();
    await expect(fallback).toHaveValue(/FunctionFixture/);
    await expect(page.locator("[data-pickfix-prompt-output]")).toHaveValue(/FunctionFixture/);
    await expect(page.locator("[data-pickfix-prompt-status]")).toContainText("Clipboard blocked");

    // When: the user starts a new ImportedFixture selection after the fallback has settled.
    await selectImportedFixture(page);

    // Then: the previous manual-copy fallback, prompt output, and status are not stale.
    await expect(page.locator("[data-pickfix-component-name]")).toHaveText("ImportedFixture");
    await expect(page.locator("[data-pickfix-clipboard-fallback-region]")).toBeHidden();
    await expect(fallback).toHaveValue("");
    await expect(page.locator("[data-pickfix-prompt-output]")).toHaveValue("");
    await expect(page.locator("[data-pickfix-prompt-status]")).toHaveText("");
  });
});

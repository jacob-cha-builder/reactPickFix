import { expect, test } from "@playwright/test";

import { selectFunctionFixture } from "./handoff-helpers";

test.describe("prompt composer removed position controls", () => {
  test("omits removed position controls from prompt requests", async ({ page }) => {
    await page.goto("/");
    await selectFunctionFixture(page);

    await page.getByLabel("Comment").fill("Change the button copy to Review changes.");
    await expect(page.getByLabel("Font size")).toHaveCount(0);
    await expect(page.locator("[data-pickfix-intent-size]")).toHaveCount(0);
    await expect(page.getByLabel("Left / right")).toHaveCount(0);
    await expect(page.locator("[data-pickfix-intent-position-x]")).toHaveCount(0);
    await expect(page.getByLabel("Up / down")).toHaveCount(0);
    await expect(page.locator("[data-pickfix-intent-position-y]")).toHaveCount(0);
    await page.getByRole("button", { name: "Create prompt" }).click();

    const output = page.locator("[data-pickfix-prompt-output]");
    await expect(output).toHaveValue(/Component: FunctionFixture/);
    const prompt = await output.inputValue();

    expect(prompt).toContain("Comment: Change the button copy to Review changes.");
    expect(prompt).not.toContain("Font size:");
    expect(prompt).not.toContain("Position:");
  });
});

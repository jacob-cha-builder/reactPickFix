import { expect, test } from "@playwright/test";

import { selectFunctionFixture } from "./handoff-helpers";

test.describe("prompt composer slider defaults", () => {
  test("omits default slider values from prompt requests", async ({ page }) => {
    await page.goto("/");
    await selectFunctionFixture(page);

    await page.getByLabel("Comment").fill("Change the button copy to Review changes.");
    await expect(page.getByLabel("Font size")).toBeHidden();
    await expect(page.locator("[data-pickfix-intent-size]")).toHaveValue("0");
    await expect(page.getByLabel("Left / right")).toHaveValue("0");
    await expect(page.getByLabel("Up / down")).toHaveValue("0");
    await page.getByRole("button", { name: "Copy prompt" }).click();

    const output = page.locator("[data-pickfix-prompt-output]");
    await expect(output).toHaveValue(/Component: FunctionFixture/);
    const prompt = await output.inputValue();

    expect(prompt).toContain("Comment: Change the button copy to Review changes.");
    expect(prompt).not.toContain("Font size:");
    expect(prompt).not.toContain("Position:");
  });
});

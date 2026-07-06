import { expect, test } from "@playwright/test";

import { selectFunctionFixture, selectImportedFixture } from "./handoff-helpers";
import { computedFontSize, inlineFontSize, inlineTransform } from "./prompt-composer-helpers";

test.describe("prompt composer size control removal", () => {
  test("does not show a font-size control on direct text targets", async ({ page }) => {
    await page.goto("/");
    const toggle = page.locator("[data-pickfix-toggle]");
    if ((await toggle.getAttribute("aria-pressed")) !== "true") {
      await toggle.click();
    }

    const component = page.getByTestId("function-component");
    const heading = component.getByRole("heading", { name: "Function component revenue snapshot" });
    const originalComputedSize = await computedFontSize(heading);
    const originalInlineSize = await inlineFontSize(heading);

    await heading.click();
    await expect(page.locator("[data-pickfix-component-name]")).toHaveText("FunctionFixture");
    await expect(page.getByLabel("Text 수정")).toBeVisible();
    await expect(page.getByLabel("Font size")).toHaveCount(0);
    await expect(page.locator("[data-pickfix-intent-size]")).toHaveCount(0);
    await expect(page.getByLabel("Left / right")).toHaveCount(0);
    await expect(page.locator("[data-pickfix-intent-position-x]")).toHaveCount(0);
    await expect(page.getByLabel("Up / down")).toHaveCount(0);
    await expect(page.locator("[data-pickfix-intent-position-y]")).toHaveCount(0);

    await expect.poll(async () => inlineTransform(component)).toBe("");
    await expect.poll(async () => inlineTransform(heading)).toBe("");
    await expect.poll(async () => computedFontSize(heading)).toBe(originalComputedSize);
    await expect.poll(async () => inlineFontSize(heading)).toBe(originalInlineSize);
  });

  test("does not show a font-size control on component container targets", async ({ page }) => {
    await page.goto("/");
    await selectFunctionFixture(page);

    const component = page.getByTestId("function-component");
    const heading = component.getByRole("heading", { name: "Function component revenue snapshot" });
    const originalComputedSize = await computedFontSize(heading);

    await expect(page.getByLabel("Font size")).toHaveCount(0);
    await expect(page.locator("[data-pickfix-intent-size]")).toHaveCount(0);
    await expect(page.getByLabel("Left / right")).toHaveCount(0);
    await expect(page.locator("[data-pickfix-intent-position-x]")).toHaveCount(0);
    await expect(page.getByLabel("Up / down")).toHaveCount(0);
    await expect(page.locator("[data-pickfix-intent-position-y]")).toHaveCount(0);

    await expect.poll(async () => inlineFontSize(component)).toBe("");
    await expect.poll(async () => inlineFontSize(heading)).toBe("");
    await expect.poll(async () => computedFontSize(heading)).toBe(originalComputedSize);
    await expect.poll(async () => inlineTransform(component)).toBe("");
  });

  for (const action of [
    { name: "close", selector: "[data-pickfix-close]" },
    { name: "reset", selector: "[data-pickfix-reset]" },
  ] as const) {
    test(`keeps text font size unchanged when selection is cleared by ${action.name}`, async ({ page }) => {
      await page.goto("/");
      const toggle = page.locator("[data-pickfix-toggle]");
      if ((await toggle.getAttribute("aria-pressed")) !== "true") {
        await toggle.click();
      }

      const heading = page
        .getByTestId("function-component")
        .getByRole("heading", { name: "Function component revenue snapshot" });
      const originalComputedSize = await computedFontSize(heading);
      const originalInlineSize = await inlineFontSize(heading);

      await heading.click();
      await expect(page.locator("[data-pickfix-component-name]")).toHaveText("FunctionFixture");
      await expect(page.getByLabel("Font size")).toHaveCount(0);
      await expect(page.getByLabel("Up / down")).toHaveCount(0);
      await expect(page.locator("[data-pickfix-intent-position-y]")).toHaveCount(0);
      await expect.poll(async () => computedFontSize(heading)).toBe(originalComputedSize);

      await page.locator(action.selector).click();

      await expect(page.locator("[data-pickfix-panel]")).toBeHidden();
      await expect.poll(async () => computedFontSize(heading)).toBe(originalComputedSize);
      await expect.poll(async () => inlineFontSize(heading)).toBe(originalInlineSize);
    });
  }

  test("keeps text font size unchanged when another component is selected", async ({ page }) => {
    await page.goto("/");
    const toggle = page.locator("[data-pickfix-toggle]");
    if ((await toggle.getAttribute("aria-pressed")) !== "true") {
      await toggle.click();
    }

    const heading = page
      .getByTestId("function-component")
      .getByRole("heading", { name: "Function component revenue snapshot" });
    const originalComputedSize = await computedFontSize(heading);
    const originalInlineSize = await inlineFontSize(heading);

    await heading.click();
    await expect(page.locator("[data-pickfix-component-name]")).toHaveText("FunctionFixture");
    await expect(page.getByLabel("Font size")).toHaveCount(0);
    await expect(page.getByLabel("Up / down")).toHaveCount(0);
    await expect(page.locator("[data-pickfix-intent-position-y]")).toHaveCount(0);
    await expect.poll(async () => computedFontSize(heading)).toBe(originalComputedSize);

    await selectImportedFixture(page);

    await expect(page.locator("[data-pickfix-intent-size]")).toHaveCount(0);
    await expect(page.locator("[data-pickfix-intent-position-y]")).toHaveCount(0);
    await expect.poll(async () => computedFontSize(heading)).toBe(originalComputedSize);
    await expect.poll(async () => inlineFontSize(heading)).toBe(originalInlineSize);
  });
});

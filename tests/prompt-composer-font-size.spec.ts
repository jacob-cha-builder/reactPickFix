import { expect, test } from "@playwright/test";

import { selectFunctionFixture, selectImportedFixture, setSlider } from "./handoff-helpers";
import { computedFontSize, inlineFontSize, inlineTransform } from "./prompt-composer-helpers";

test.describe("prompt composer font-size preview", () => {
  test("previews font size on the originally clicked text target", async ({ page }) => {
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
    await expect(page.getByLabel("Font size")).toBeVisible();

    await setSlider(page, "Font size", 2);

    const expectedPreviewSize = originalComputedSize * 1.16;
    await expect.poll(async () => computedFontSize(heading)).toBeGreaterThan(originalComputedSize);
    await expect.poll(async () => inlineFontSize(heading)).toContain("px");
    await expect.poll(async () => Number.parseFloat(await inlineFontSize(heading))).toBeCloseTo(expectedPreviewSize, 1);
    await expect.poll(async () => inlineFontSize(component)).toBe("");

    await setSlider(page, "Left / right", 12);
    await expect.poll(async () => inlineTransform(component)).toContain("translate(12px, 0px)");
    await expect.poll(async () => inlineTransform(heading)).toBe("");

    await setSlider(page, "Font size", 0);

    await expect.poll(async () => computedFontSize(heading)).toBe(originalComputedSize);
    await expect.poll(async () => inlineFontSize(heading)).toBe(originalInlineSize);
  });

  test("does not preview font size when a component container has ambiguous text descendants", async ({ page }) => {
    await page.goto("/");
    await selectFunctionFixture(page);

    const component = page.getByTestId("function-component");
    const heading = component.getByRole("heading", { name: "Function component revenue snapshot" });
    const originalComputedSize = await computedFontSize(heading);

    await expect(page.getByLabel("Font size")).toBeHidden();

    await expect.poll(async () => inlineFontSize(component)).toBe("");
    await expect.poll(async () => inlineFontSize(heading)).toBe("");
    await expect.poll(async () => computedFontSize(heading)).toBe(originalComputedSize);

    await setSlider(page, "Left / right", 12);
    await expect.poll(async () => inlineTransform(component)).toContain("translate(12px, 0px)");
  });

  for (const action of [
    { name: "close", selector: "[data-pickfix-close]" },
    { name: "reset", selector: "[data-pickfix-reset]" },
  ] as const) {
    test(`restores font-size preview when selection is cleared by ${action.name}`, async ({ page }) => {
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
      await setSlider(page, "Font size", 2);
      await expect.poll(async () => computedFontSize(heading)).toBeGreaterThan(originalComputedSize);

      await page.locator(action.selector).click();

      await expect(page.locator("[data-pickfix-panel]")).toBeHidden();
      await expect.poll(async () => computedFontSize(heading)).toBe(originalComputedSize);
      await expect.poll(async () => inlineFontSize(heading)).toBe(originalInlineSize);
    });
  }

  test("restores font-size preview when another component is selected", async ({ page }) => {
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
    await setSlider(page, "Font size", 2);
    await expect.poll(async () => computedFontSize(heading)).toBeGreaterThan(originalComputedSize);

    await selectImportedFixture(page);

    await expect(page.locator("[data-pickfix-intent-size]")).toHaveValue("0");
    await expect.poll(async () => computedFontSize(heading)).toBe(originalComputedSize);
    await expect.poll(async () => inlineFontSize(heading)).toBe(originalInlineSize);
  });
});

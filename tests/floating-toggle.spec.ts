import { expect, test, type Locator, type Page } from "@playwright/test";

type ViewportPoint = {
  readonly x: number;
  readonly y: number;
};

test.describe("floating Pickfix toggle", () => {
  test("moves without activating selection mode and still toggles on click", async ({ page }) => {
    // Given: the Pickfix overlay toggle is visible but inactive.
    await page.setViewportSize({ height: 900, width: 1280 });
    await page.goto("/");
    const toggle = page.locator("[data-pickfix-toggle]");
    await expect(toggle).toBeVisible();
    await expect(toggle).toHaveAttribute("aria-pressed", "false");
    const before = await requireBox(toggle);

    // When: the user drags the floating toggle to a new position.
    await dragToggleTo(page, toggle, { x: 240, y: 220 });

    // Then: the button moves, selection mode stays inactive, and the next click toggles it.
    await expect(toggle).toHaveAttribute("aria-pressed", "false");
    await expect(page.locator("[data-pickfix-panel]")).toBeHidden();
    const after = await requireBox(toggle);
    expect(before.x - after.x).toBeGreaterThan(800);
    expect(after.y - before.y).toBeGreaterThan(120);

    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-pressed", "true");
  });

  test("clamps the dragged toggle inside the viewport", async ({ page }) => {
    // Given: the Pickfix overlay toggle starts near the viewport edge.
    await page.setViewportSize({ height: 700, width: 900 });
    await page.goto("/");
    const toggle = page.locator("[data-pickfix-toggle]");
    await expect(toggle).toBeVisible();

    // When: the user drags far beyond the top-left edge.
    await dragToggleTo(page, toggle, { x: -300, y: -240 });

    // Then: the floating control remains reachable inside the viewport.
    const box = await requireBox(toggle);
    expect(box.x).toBeGreaterThanOrEqual(8);
    expect(box.y).toBeGreaterThanOrEqual(8);
    expect(box.x + box.width).toBeLessThanOrEqual(892);
    expect(box.y + box.height).toBeLessThanOrEqual(692);
  });
});

async function dragToggleTo(page: Page, toggle: Locator, destination: ViewportPoint): Promise<void> {
  const box = await requireBox(toggle);
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(destination.x, destination.y, { steps: 8 });
  await page.mouse.up();
}

async function requireBox(locator: Locator): Promise<{ readonly height: number; readonly width: number; readonly x: number; readonly y: number }> {
  const box = await locator.boundingBox();
  if (box === null) {
    throw new Error("Expected Pickfix toggle to have a bounding box");
  }
  return box;
}

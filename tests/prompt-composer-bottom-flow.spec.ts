import { expect, test, type Page } from "@playwright/test";

import { selectFunctionFixture } from "./handoff-helpers";

test.describe("prompt composer visible flow", () => {
  test("stacks saved comments above a visible prompt output", async ({ page }) => {
    await page.goto("/");
    await selectFunctionFixture(page);

    await page.getByLabel("Comment").fill("Shorten the heading.");
    await page.getByRole("button", { name: "Comment" }).click();
    await page.getByRole("button", { name: "Copy prompt" }).click();

    await expect(page.locator("[data-pickfix-comment-list]")).toBeVisible();
    await expect(page.getByLabel("Prompt")).toBeVisible();
    await expect.poll(() => commentsAreAbovePrompt(page)).toBe(true);
  });

  test("reveals the prompt output inside the popover after copy on tablet width", async ({ page }) => {
    await page.setViewportSize({ height: 900, width: 768 });
    await page.goto("/");
    await selectFunctionFixture(page);

    await page.getByLabel("Comment").fill("Shorten the heading.");
    await page.getByRole("button", { name: "Comment" }).click();
    await page.getByRole("button", { name: "Copy prompt" }).click();

    await expect.poll(() => promptOutputIsInViewport(page)).toBe(true);
  });
});

async function commentsAreAbovePrompt(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const comments = document.querySelector("[data-pickfix-comment-list]");
    const prompt = document.querySelector("[data-pickfix-prompt-output]");
    if (!(comments instanceof HTMLElement) || !(prompt instanceof HTMLElement)) return false;
    const commentsBox = comments.getBoundingClientRect();
    const promptBox = prompt.getBoundingClientRect();
    return commentsBox.bottom <= promptBox.top;
  });
}

async function promptOutputIsInViewport(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const prompt = document.querySelector("[data-pickfix-prompt-output]");
    if (!(prompt instanceof HTMLElement)) return false;
    const box = prompt.getBoundingClientRect();
    return box.top >= 0 && box.bottom <= window.innerHeight && box.left >= 0 && box.right <= window.innerWidth;
  });
}

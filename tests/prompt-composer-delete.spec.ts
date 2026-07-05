import { expect, test } from "@playwright/test";

import { selectFunctionFixture } from "./handoff-helpers";

test("deletes saved comments and renumbers markers and copied prompt comments", async ({ page }) => {
  await page.goto("/");
  await selectFunctionFixture(page);

  await page.getByLabel("Comment").fill("Remove this stale note.");
  await page.getByRole("button", { name: "Comment" }).click();
  await page.getByLabel("Comment").fill("Keep this note.");
  await page.getByRole("button", { name: "Comment" }).click();
  await expect(page.locator("[data-pickfix-comment-marker]")).toHaveText(["1", "2"]);

  await page.getByRole("button", { name: "Delete saved note 1" }).click();

  const commentList = page.locator("[data-pickfix-comment-list]");
  await expect(commentList).not.toContainText("Remove this stale note.");
  await expect(commentList).toContainText("1. FunctionFixture: Keep this note.");
  await expect(page.locator("[data-pickfix-comment-marker]")).toHaveText(["1"]);

  await page.getByRole("button", { name: "Copy prompt" }).click();

  const output = page.locator("[data-pickfix-prompt-output]");
  await expect(output).toHaveValue(/Component: FunctionFixture/);
  const prompt = await output.inputValue();
  expect(prompt).not.toContain("Remove this stale note.");
  expect(prompt).toContain("1. FunctionFixture: Keep this note.");
});

import { expect, test, type Page } from "@playwright/test";

import { PromptChangeSchema } from "../packages/shared/src/schemas";
import { setSlider } from "./handoff-helpers";
import { requireRecord } from "./prompt-composer-helpers";

test("saves comment text, text change comments, and slider adjustments as independent comment entries", async ({ page }) => {
  const promptRequests: Readonly<Record<string, unknown>>[] = [];
  await page.route("**/__pickfix/prompt", async (route) => {
    const requestBody = route.request().postData();
    if (requestBody === null) {
      throw new Error("Prompt request did not include a body");
    }
    promptRequests.push(requireRecord(JSON.parse(requestBody)));
    await route.continue();
  });

  await page.goto("/");
  const toggle = page.locator("[data-pickfix-toggle]");
  if ((await toggle.getAttribute("aria-pressed")) !== "true") {
    await toggle.click();
  }

  await page.getByTestId("function-component").click();
  await expect(page.locator("[data-pickfix-component-name]")).toHaveText("FunctionFixture");
  await page.getByLabel("Comment").fill("Make this card calmer.");
  await page.getByRole("button", { name: "Comment" }).click();

  const heading = page.getByTestId("function-component").locator("h2");
  await heading.click();
  await expectComposerVisibleAfterPointerMove(page);
  await page.getByLabel("Text 수정").fill("Revenue snapshot");
  await page.getByRole("button", { name: "Comment" }).click();

  await page.getByTestId("nested-component").locator("h2").click();
  await expect(page.locator("[data-pickfix-component-name]")).toHaveText("NestedFixture");
  await expectComposerVisibleAfterPointerMove(page);
  await setSlider(page, "Font size", 2);
  await setSlider(page, "Left / right", -12);
  await setSlider(page, "Up / down", 24);
  await page.getByRole("button", { name: "Comment" }).click();

  await expect(page.locator("[data-pickfix-comment-list]")).toContainText("1. FunctionFixture: Make this card calmer.");
  await expect(page.locator("[data-pickfix-comment-list]")).toContainText(
    '2. FunctionFixture: Text 수정: replace "Function component revenue snapshot" with "Revenue snapshot"',
  );
  await expect(page.locator("[data-pickfix-comment-list]")).toContainText(
    "3. NestedFixture: Font size: font size +16%; Position: x -12px, y +24px",
  );
  await expect(page.locator("[data-pickfix-comment-marker]")).toHaveText(["1", "2", "3"]);

  await page.getByRole("button", { name: "Copy prompt" }).click();

  await expect.poll(() => promptRequests.length).toBe(1);
  const promptRequest = promptRequests[0];
  if (promptRequest === undefined) {
    throw new Error("Prompt request was not captured");
  }
  const parsedChange = PromptChangeSchema.safeParse(requireRecord(promptRequest["change"]));
  expect(parsedChange.success).toBe(true);
  if (!parsedChange.success) {
    throw new Error(parsedChange.error.message);
  }
  expect(parsedChange.data.comments).toEqual([
    "FunctionFixture: Make this card calmer.",
    'FunctionFixture: Text 수정: replace "Function component revenue snapshot" with "Revenue snapshot"',
    "NestedFixture: Font size: font size +16%; Position: x -12px, y +24px",
  ]);
  expect(parsedChange.data.textEdit).toBeUndefined();
  expect(parsedChange.data.size).toBeUndefined();
  expect(parsedChange.data.position).toBeUndefined();

  const output = page.locator("[data-pickfix-prompt-output]");
  await expect(output).toHaveValue(/Comments/);
  const prompt = await output.inputValue();
  expect(prompt).toContain("1. FunctionFixture: Make this card calmer.");
  expect(prompt).toContain('2. FunctionFixture: Text 수정: replace "Function component revenue snapshot" with "Revenue snapshot"');
  expect(prompt).toContain("3. NestedFixture: Font size: font size +16%; Position: x -12px, y +24px");
});

test("bundles text edits, comment text, font size, and position into one saved comment", async ({ page }) => {
  await page.goto("/");
  const toggle = page.locator("[data-pickfix-toggle]");
  if ((await toggle.getAttribute("aria-pressed")) !== "true") {
    await toggle.click();
  }

  const heading = page.getByTestId("function-component").locator("h2");
  await heading.click();
  await expect(page.locator("[data-pickfix-component-name]")).toHaveText("FunctionFixture");

  await page.getByLabel("Text 수정").fill("Revenue snapshot");
  await page.getByLabel("Comment").fill("Make the headline more compact.");
  await setSlider(page, "Font size", 2);
  await setSlider(page, "Left / right", -12);
  await setSlider(page, "Up / down", 24);
  await page.getByRole("button", { name: "Comment" }).click();

  const commentList = page.locator("[data-pickfix-comment-list]");
  await expect(commentList).toContainText(
    '1. FunctionFixture: Text 수정: replace "Function component revenue snapshot" with "Revenue snapshot"; Make the headline more compact.; Font size: font size +16%; Position: x -12px, y +24px',
  );
  await expect(page.locator("[data-pickfix-comment-marker]")).toHaveText(["1"]);
});

test("keeps composer visible when selecting another target after a comment", async ({ page }) => {
  await page.goto("/");
  const toggle = page.locator("[data-pickfix-toggle]");
  if ((await toggle.getAttribute("aria-pressed")) !== "true") {
    await toggle.click();
  }

  await page.getByTestId("function-component").click();
  await page.getByLabel("Comment").fill("First covered-selection comment.");
  await page.getByRole("button", { name: "Comment" }).click();

  await page.getByTestId("css-module-component").locator("button").click();
  await expect(page.locator("[data-pickfix-component-name]")).toHaveText("CssModuleFixture");
  await expectComposerVisibleAfterPointerMove(page);
  await expect(page.locator("[data-pickfix-comment-list]")).toContainText(
    "1. FunctionFixture: First covered-selection comment.",
  );
  await page.getByLabel("Comment").fill("Second right-side-selection comment.");
  await page.getByRole("button", { name: "Comment" }).click();
  await expect(page.locator("[data-pickfix-comment-marker]")).toHaveText(["1", "2"]);
});

async function expectComposerVisibleAfterPointerMove(page: Page): Promise<void> {
  await page.mouse.move(12, 12);
  await expect(page.getByLabel("Comment")).toBeVisible();
  await expect(page.getByRole("button", { name: "Comment" })).toBeVisible();
  await expect(page.locator("[data-pickfix-comment-list]")).toBeVisible();
}

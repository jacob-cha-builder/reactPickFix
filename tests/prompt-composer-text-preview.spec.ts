import { expect, test, type Page } from "@playwright/test";

import { PromptChangeSchema } from "../packages/shared/src/schemas";
import { selectFunctionFixture } from "./handoff-helpers";
import { requireRecord } from "./prompt-composer-helpers";

test.describe("prompt composer text comments", () => {
  test("saves Text 수정 changes only after Comment", async ({ page }) => {
    await page.goto("/");
    const toggle = page.locator("[data-pickfix-toggle]");
    if ((await toggle.getAttribute("aria-pressed")) !== "true") {
      await toggle.click();
    }

    const heading = page.getByTestId("function-component").locator("h2");
    const originalText = await heading.textContent();

    await heading.click();
    await expect(page.locator("[data-pickfix-component-name]")).toHaveText("FunctionFixture");

    await expect(page.getByLabel("Text 수정")).toBeVisible();
    await expect(page.getByLabel("Text 수정")).toHaveValue(originalText ?? "");
    await expect.poll(() => textEditIsAboveComment(page)).toBe(true);

    await page.getByLabel("Text 수정").fill("Revenue snapshot");
    await expect(page.locator("[data-pickfix-comment-marker]")).toHaveCount(0);
    await page.getByRole("button", { name: "Comment" }).click();

    await expect(heading).toHaveText(originalText ?? "");
    await expect(page.locator("[data-pickfix-comment-marker]")).toHaveText(["1"]);
    await expect.poll(() => commentMarkerOffset(page)).toEqual({ dx: 0, dy: 0, text: "1" });
    await expect(page.locator("[data-pickfix-comment-list]")).toContainText(
      'Text 수정: replace "Function component revenue snapshot" with "Revenue snapshot"',
    );
  });

  test("does not offer text editing for ambiguous component container text", async ({ page }) => {
    await page.goto("/");
    await selectFunctionFixture(page);

    await expect(page.locator("[data-pickfix-text-edit]")).toBeHidden();
    await expect(page.getByLabel("Text 수정")).toBeHidden();
  });

  test("orders text edit, comment, sliders, and the Comment action as one flow", async ({ page }) => {
    await page.goto("/");
    const toggle = page.locator("[data-pickfix-toggle]");
    if ((await toggle.getAttribute("aria-pressed")) !== "true") {
      await toggle.click();
    }

    await page.getByTestId("function-component").locator("h2").click();

    await expect(page.getByLabel("Text 수정")).toBeVisible();
    await expect(page.getByLabel("Font size")).toBeVisible();
    await expect.poll(() => composerFieldOrder(page)).toEqual([
      "text",
      "comment",
      "size",
      "x",
      "y",
      "button",
    ]);
  });

  test("sends saved Text 수정 requests as ordinary saved comments", async ({ page }) => {
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

    const heading = page.getByTestId("function-component").locator("h2");
    await heading.click();
    await page.getByLabel("Text 수정").fill("Revenue snapshot");
    await page.getByRole("button", { name: "Comment" }).click();
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
      'FunctionFixture: Text 수정: replace "Function component revenue snapshot" with "Revenue snapshot"',
    ]);
    expect(parsedChange.data.textEdit).toBeUndefined();
  });
});

async function textEditIsAboveComment(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const textEdit = document.querySelector("[data-pickfix-text-edit]");
    const comment = document.querySelector("[data-pickfix-comment-field]");
    if (!(textEdit instanceof HTMLElement) || !(comment instanceof HTMLElement)) return false;
    return textEdit.getBoundingClientRect().bottom <= comment.getBoundingClientRect().top;
  });
}

async function commentMarkerOffset(page: Page): Promise<{ readonly dx: number; readonly dy: number; readonly text: string }> {
  return page.evaluate(() => {
    const heading = document.querySelector("[data-testid='function-component'] h2");
    const marker = document.querySelector("[data-pickfix-comment-marker]");
    if (!(heading instanceof HTMLElement) || !(marker instanceof HTMLElement)) {
      throw new Error("Expected heading and marker to exist");
    }
    const headingBox = heading.getBoundingClientRect();
    const markerBox = marker.getBoundingClientRect();
    return {
      dx: Math.round(markerBox.left - headingBox.left),
      dy: Math.round(markerBox.top - headingBox.top),
      text: marker.textContent ?? "",
    };
  });
}

async function composerFieldOrder(page: Page): Promise<readonly string[]> {
  return page.evaluate(() => {
    const fields = [
      ["text", "[data-pickfix-text-edit]"],
      ["comment", "[data-pickfix-comment-field]"],
      ["size", "[data-pickfix-font-size-field]"],
      ["x", "[data-pickfix-intent-position-x]"],
      ["y", "[data-pickfix-intent-position-y]"],
      ["button", "[data-pickfix-add-comment]"],
    ] as const;

    return fields
      .map(([name, selector]) => {
        const element = document.querySelector(selector);
        if (!(element instanceof HTMLElement)) {
          throw new Error(`Expected ${selector} to exist`);
        }
        return { name, top: element.getBoundingClientRect().top };
      })
      .sort((left, right) => left.top - right.top)
      .map((entry) => entry.name);
  });
}

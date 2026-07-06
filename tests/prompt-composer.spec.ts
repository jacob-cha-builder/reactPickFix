import { expect, test, type Page } from "@playwright/test";

import { PromptChangeSchema } from "../packages/shared/src/schemas";
import { selectFunctionFixture } from "./handoff-helpers";
import { expectFirstCommentMarkerAligned, requireRecord } from "./prompt-composer-helpers";

test.describe("prompt composer", () => {
  test("shows accessible prompt composer controls", async ({ page }) => {
    // Given: a high-confidence component is selected in the fixture app.
    await page.goto("/");
    await selectFunctionFixture(page);

    await expect(page.getByLabel("Comment")).toBeVisible();
    await expect(page.getByLabel("Font size")).toHaveCount(0);
    await expect(page.getByLabel("Left / right")).toHaveCount(0);
    await expect(page.locator("[data-pickfix-intent-position-x]")).toHaveCount(0);
    await expect(page.getByLabel("Up / down")).toHaveCount(0);
    await expect(page.locator("[data-pickfix-intent-position-y]")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Add comment" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Create prompt" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Copy Claude prompt" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Copy Codex command" })).toHaveCount(0);

    await page.getByTestId("function-component").locator("h2").click();
    await expect(page.getByLabel("Text 수정")).toBeVisible();
    await expect(page.getByLabel("Font size")).toHaveCount(0);
  });

  test("collects numbered comments and includes all comments in the copied prompt", async ({ page }) => {
    await page.goto("/");
    await selectFunctionFixture(page);

    await page.getByLabel("Comment").fill("Shorten the heading.");
    await page.getByRole("button", { name: "Add comment" }).click();
    await expect(page.locator("[data-pickfix-comment-marker]")).toHaveText(["1"]);
    await expectFirstCommentMarkerAligned(page);

    await page.getByLabel("Comment").fill("Move the action button right.");
    await expect(page.locator("[data-pickfix-comment-marker]")).toHaveText(["1"]);
    await expectFirstCommentMarkerAligned(page);

    await page.getByRole("button", { name: "Add comment" }).click();
    await expect(page.locator("[data-pickfix-comment-list]")).toContainText("1. FunctionFixture: Shorten the heading.");
    await expect(page.locator("[data-pickfix-comment-list]")).toContainText(
      "2. FunctionFixture: Move the action button right.",
    );
    await expect(page.locator("[data-pickfix-comment-marker]")).toHaveText(["1", "2"]);
    await expectFirstCommentMarkerAligned(page);

    await expectFirstCommentMarkerAligned(page);

    await page.evaluate(() => window.scrollBy(0, 40));
    await expectFirstCommentMarkerAligned(page);

    await page.setViewportSize({ height: 820, width: 1180 });
    await expectFirstCommentMarkerAligned(page);

    await page.getByRole("button", { name: "Create prompt" }).click();

    const output = page.locator("[data-pickfix-prompt-output]");
    await expect(output).toHaveValue(/Component: FunctionFixture/);
    const prompt = await output.inputValue();
    expect(prompt).toContain("Comments");
    expect(prompt).toContain("1. FunctionFixture: Shorten the heading.");
    expect(prompt).toContain("2. FunctionFixture: Move the action button right.");
    expect(prompt).not.toContain("Comment: Not requested");
  });

  test("keeps numbered comments attached across component selection changes", async ({ page }) => {
    await page.goto("/");
    await selectFunctionFixture(page);

    await page.getByLabel("Comment").fill("First comment.");
    await page.getByRole("button", { name: "Add comment" }).click();

    await page.getByTestId("nested-component").locator("h2").click();
    await expect(page.locator("[data-pickfix-component-name]")).toHaveText("NestedFixture");
    await page.getByLabel("Comment").fill("Second comment.");
    await page.getByRole("button", { name: "Add comment" }).click();

    await page.getByTestId("nested-component").locator("button").click();
    await expect(page.locator("[data-pickfix-component-name]")).toHaveText("NestedFixture");
    await page.getByLabel("Comment").fill("Third comment.");
    await page.getByRole("button", { name: "Add comment" }).click();

    await expect(page.locator("[data-pickfix-comment-list]")).toContainText("1. FunctionFixture: First comment.");
    await expect(page.locator("[data-pickfix-comment-list]")).toContainText("2. NestedFixture: Second comment.");
    await expect(page.locator("[data-pickfix-comment-list]")).toContainText("3. NestedFixture: Third comment.");
    await expect(page.locator("[data-pickfix-comment-marker]")).toHaveText(["1", "2", "3"]);
  });

  test("scrolls saved comments when the comment list overflows", async ({ page }) => {
    // Given: enough saved comments to overflow the compact comment list.
    await page.goto("/");
    await selectFunctionFixture(page);
    for (let index = 1; index <= 8; index += 1) {
      await page.getByLabel("Comment").fill(`Scrollable comment ${index}`);
      await page.getByRole("button", { name: "Add comment" }).click();
    }
    const commentList = page.locator("[data-pickfix-comment-list]");
    await expect(commentList).toContainText("8. FunctionFixture: Scrollable comment 8");
    const metrics = await commentList.evaluate((element) => {
      if (!(element instanceof HTMLElement)) {
        throw new Error("Expected the comment list to be an HTML element");
      }

      return {
        clientHeight: element.clientHeight,
        scrollHeight: element.scrollHeight,
      };
    });
    expect(metrics.scrollHeight).toBeGreaterThan(metrics.clientHeight);

    // When: the user scrolls over the visible comment list.
    const box = await commentList.boundingBox();
    if (box === null) {
      throw new Error("Expected the comment list to have a visible bounding box");
    }
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.wheel(0, 220);

    // Then: the comment list itself scrolls instead of passing the wheel to the host page.
    await expect
      .poll(async () =>
        commentList.evaluate((element) => {
          if (!(element instanceof HTMLElement)) {
            throw new Error("Expected the comment list to be an HTML element");
          }

          return element.scrollTop;
        }),
      )
      .toBeGreaterThan(0);
  });

  test("anchors numbered comments to the clicked text target inside one component", async ({ page }) => {
    await page.goto("/");
    await selectFunctionFixture(page);
    const component = page.getByTestId("function-component");

    await component.locator("h2").click();
    await page.getByLabel("Comment").fill("Heading comment.");
    await page.getByRole("button", { name: "Add comment" }).click();

    await component.locator("button").click();
    await page.getByLabel("Comment").fill("Button comment.");
    await page.getByRole("button", { name: "Add comment" }).click();

    await component.locator("h2").click();
    await page.getByLabel("Comment").fill("Second heading comment.");
    await page.getByRole("button", { name: "Add comment" }).click();

    await expect(page.locator("[data-pickfix-comment-list]")).toContainText("1. FunctionFixture: Heading comment.");
    await expect(page.locator("[data-pickfix-comment-list]")).toContainText("2. FunctionFixture: Button comment.");
    await expect(page.locator("[data-pickfix-comment-list]")).toContainText(
      "3. FunctionFixture: Second heading comment.",
    );
    await expect(page.locator("[data-pickfix-comment-marker]")).toHaveText(["1", "2", "3"]);
    await expect.poll(() => commentMarkerOffsets(page)).toEqual([
      { dx: 0, dy: 0, marker: "1", target: "heading" },
      { dx: 0, dy: 0, marker: "2", target: "button" },
      { dx: 22, dy: 0, marker: "3", target: "heading" },
    ]);
  });

  test("caps saved comments before draft text when composing prompt change", async ({ page }) => {
    const savedComments = Array.from({ length: 20 }, (_value, index) => `Saved comment ${index + 1}`);
    const draftComment = "Draft comment should wait.";
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
    await selectFunctionFixture(page);

    for (const comment of savedComments) {
      await page.getByLabel("Comment").fill(comment);
      await page.getByRole("button", { name: "Add comment" }).click();
    }
    await page.getByLabel("Comment").fill(draftComment);
    await page.getByRole("button", { name: "Create prompt" }).click();

    await expect.poll(() => promptRequests.length).toBe(1);
    const promptRequest = promptRequests[0];
    if (promptRequest === undefined) {
      throw new Error("Prompt request was not captured");
    }
    const change = requireRecord(promptRequest["change"]);
    const parsedChange = PromptChangeSchema.safeParse(change);
    expect(parsedChange.success).toBe(true);
    if (!parsedChange.success) {
      throw new Error(parsedChange.error.message);
    }
    expect(parsedChange.data.comments).toEqual(savedComments.map((comment) => `FunctionFixture: ${comment}`));
  });

  test("includes numbered comments from text-target comments in the copied prompt", async ({ page }) => {
    await page.goto("/");
    const toggle = page.locator("[data-pickfix-toggle]");
    if ((await toggle.getAttribute("aria-pressed")) !== "true") {
      await toggle.click();
    }
    const heading = page.getByTestId("function-component").locator("h2");

    await heading.click();
    await expect(page.locator("[data-pickfix-component-name]")).toHaveText("FunctionFixture");
    await page.getByLabel("Comment").fill("Shorten the heading.");
    await page.getByRole("button", { name: "Add comment" }).click();
    await page.getByLabel("Comment").fill("Move the action button right.");
    await page.getByRole("button", { name: "Add comment" }).click();
    await expect(page.getByLabel("Text 수정")).toBeVisible();

    await page.getByRole("button", { name: "Create prompt" }).click();

    const output = page.locator("[data-pickfix-prompt-output]");
    await expect(output).toHaveValue(/Component: FunctionFixture/);
    const prompt = await output.inputValue();
    expect(prompt).toContain("Comments");
    expect(prompt).toContain("1. FunctionFixture: Shorten the heading.");
    expect(prompt).toContain("2. FunctionFixture: Move the action button right.");
    expect(prompt).not.toContain("Text edit:");
    expect(prompt).not.toContain("Verification commands");
    expect(prompt).not.toContain("Package scripts");
    expect(prompt).not.toContain("DOM snapshot");
    expect(prompt).not.toContain("Context limits");
  });

});

type CommentMarkerOffset = {
  readonly dx: number;
  readonly dy: number;
  readonly marker: string;
  readonly target: "button" | "heading";
};

async function commentMarkerOffsets(page: Page): Promise<readonly CommentMarkerOffset[]> {
  return page.evaluate(() => {
    const heading = document.querySelector("[data-testid='function-component'] h2");
    const button = document.querySelector("[data-testid='function-component'] button");
    const markers = [...document.querySelectorAll("[data-pickfix-comment-marker]")];
    if (!(heading instanceof HTMLElement) || !(button instanceof HTMLElement)) {
      throw new Error("Expected heading and button targets to exist");
    }
    const boxes = {
      button: button.getBoundingClientRect(),
      heading: heading.getBoundingClientRect(),
    };
    return markers.map((marker, index) => {
      if (!(marker instanceof HTMLElement)) {
        throw new Error("Expected marker to be an element");
      }
      const markerBox = marker.getBoundingClientRect();
      const target = index === 1 ? "button" : "heading";
      const targetBox = boxes[target];
      return {
        dx: Math.round(markerBox.left - targetBox.left),
        dy: Math.round(markerBox.top - targetBox.top),
        marker: marker.textContent ?? "",
        target,
      };
    });
  });
}

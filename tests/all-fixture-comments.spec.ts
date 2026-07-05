import { expect, test, type Locator, type Page } from "@playwright/test";

type FixtureTarget = {
  readonly comment: string;
  readonly expectedComponent: string;
  readonly locator: (page: Page) => Locator;
};

const mainPageTargets: readonly FixtureTarget[] = [
  target("function heading", "FunctionFixture", (page) => page.getByTestId("function-component").locator("h2")),
  target("function button", "FunctionFixture", (page) => page.getByTestId("function-component").locator("button")),
  target("nested heading", "NestedFixture", (page) => page.getByTestId("nested-component").locator("h2")),
  target("nested button", "NestedFixture", (page) => page.getByTestId("nested-component").locator("button")),
  target("imported heading", "ImportedFixture", (page) => page.getByTestId("imported-component").locator("h2")),
  target("imported copy", "ImportedFixture", (page) => page.getByTestId("imported-component").locator(".fixture-copy")),
  target("imported button", "ImportedFixture", (page) => page.getByTestId("imported-component").locator("button")),
  target("css module heading", "CssModuleFixture", (page) => page.getByTestId("css-module-component").locator("h2")),
  target("css module button", "CssModuleFixture", (page) => page.getByTestId("css-module-component").locator("button")),
  target("utility heading", "UtilityClassFixture", (page) => page.getByTestId("utility-class-component").locator("h2")),
  target("utility button", "UtilityClassFixture", (page) => page.getByTestId("utility-class-component").locator("button")),
  target("portal host heading", "PortalModalFixture", (page) => page.getByTestId("portal-host-component").locator("h2")),
  target("repeated heading", "RepeatedListFixture", (page) => page.locator("#repeated-list-heading")),
  target("repeated item alpha text", "RepeatedListFixture", (page) =>
    page.getByTestId("repeated-list-item").nth(0).locator("span"),
  ),
  target("repeated item alpha button", "RepeatedListFixture", (page) =>
    page.getByTestId("repeated-list-item").nth(0).locator("button"),
  ),
  target("repeated item beta text", "RepeatedListFixture", (page) =>
    page.getByTestId("repeated-list-item").nth(1).locator("span"),
  ),
  target("repeated item gamma button", "RepeatedListFixture", (page) =>
    page.getByTestId("repeated-list-item").nth(2).locator("button"),
  ),
  target("plain dom fallback", "Unmapped element", (page) => page.locator(".plain-dom-fixture")),
];

const portalTargets: readonly FixtureTarget[] = [
  target("portal modal heading", "PortalModalFixture", (page) => page.getByTestId("portal-modal-component").locator("h2")),
  target("portal modal paragraph", "PortalModalFixture", (page) => page.getByTestId("portal-modal-component").locator("p")),
];

test.describe("all fixture targets can be commented", () => {
  test("adds numbered comments to every main page target", async ({ page }) => {
    await page.goto("/");
    await activatePickfix(page);

    await addCommentsForTargets(page, mainPageTargets);
  });

  test("adds numbered comments to portal modal targets", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Open portal modal" }).click();
    await activatePickfix(page);

    await addCommentsForTargets(page, portalTargets);
  });
});

function target(comment: string, expectedComponent: string, locator: (page: Page) => Locator): FixtureTarget {
  return { comment, expectedComponent, locator };
}

async function activatePickfix(page: Page): Promise<void> {
  const toggle = page.locator("[data-pickfix-toggle]");
  if ((await toggle.getAttribute("aria-pressed")) !== "true") {
    await toggle.click();
  }
}

async function addCommentsForTargets(page: Page, targets: readonly FixtureTarget[]): Promise<void> {
  for (const [index, fixtureTarget] of targets.entries()) {
    await fixtureTarget.locator(page).scrollIntoViewIfNeeded();
    await fixtureTarget.locator(page).click();
    await expect(page.locator("[data-pickfix-component-name]")).toHaveText(fixtureTarget.expectedComponent);

    const comment = `Comment for ${fixtureTarget.comment}`;
    await page.getByLabel("Comment").fill(comment);
    await page.getByRole("button", { name: "Comment" }).click();

    const expectedNumber = index + 1;
    await expect(page.locator("[data-pickfix-comment-list]")).toContainText(
      `${expectedNumber}. ${fixtureTarget.expectedComponent}: ${comment}`,
    );
    await expect(page.locator("[data-pickfix-comment-marker]")).toHaveText(numberLabels(expectedNumber));
  }
}

function numberLabels(count: number): readonly string[] {
  return Array.from({ length: count }, (_value, index) => String(index + 1));
}

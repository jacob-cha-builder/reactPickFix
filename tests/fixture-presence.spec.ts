import { expect, test } from "@playwright/test";

test.describe("vite react fixture surface", () => {
  test("shows every required component mapping case", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByRole("heading", { name: "Pickfix Vite React fixture" })).toBeVisible();
    const functionComponent = page.getByTestId("function-component");
    await expect(functionComponent).toContainText("Function component");
    await expect(functionComponent.getByRole("button", { name: "Function component action" })).toBeVisible();

    const nestedComponent = page.getByTestId("nested-component");
    await expect(nestedComponent).toContainText("Nested component");
    await expect(nestedComponent.getByRole("button", { name: "Nested component action" })).toBeVisible();

    const importedComponent = page.getByTestId("imported-component");
    await expect(importedComponent).toContainText("Imported component");
    await expect(importedComponent.getByRole("button", { name: "Imported component action" })).toBeVisible();

    const cssModuleComponent = page.getByTestId("css-module-component");
    await expect(cssModuleComponent).toContainText("CSS module component");
    await expect(cssModuleComponent.getByRole("button", { name: "CSS module action" })).toBeVisible();

    const utilityClassComponent = page.getByTestId("utility-class-component");
    await expect(utilityClassComponent).toContainText("Utility-class component");
    await expect(utilityClassComponent.getByRole("button", { name: "Utility action" })).toBeVisible();

    await expect(page.getByTestId("plain-dom-node")).toContainText("Plain DOM node");

    const listItems = page.getByTestId("repeated-list-item");
    await expect(listItems).toHaveCount(3);
    await expect(listItems.nth(0)).toContainText("Repeated item Alpha");
    await expect(listItems.nth(0).getByRole("button", { name: "Select Alpha" })).toBeVisible();
    await expect(listItems.nth(1)).toContainText("Repeated item Beta");
    await expect(listItems.nth(1).getByRole("button", { name: "Select Beta" })).toBeVisible();
    await expect(listItems.nth(2)).toContainText("Repeated item Gamma");
    await expect(listItems.nth(2).getByRole("button", { name: "Select Gamma" })).toBeVisible();

    await expect(page.getByRole("button", { name: "Open portal modal" })).toBeVisible();
    await page.getByRole("button", { name: "Open portal modal" }).click();
    await expect(page.getByRole("dialog", { name: "Portal modal component" })).toBeVisible();
    const portalModal = page.getByTestId("portal-modal-component");
    await expect(portalModal).toContainText("Portal modal component");
    await expect(portalModal.getByRole("button", { name: "Close portal modal" })).toBeVisible();
  });
});

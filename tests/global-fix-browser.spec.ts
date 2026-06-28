import { expect, type Page, test } from "@playwright/test";

type RuntimeElementResolution =
  | {
      readonly confidence: "high";
      readonly ownerChain: readonly string[];
      readonly reason: "Source metadata";
      readonly selectionId: string;
    }
  | {
      readonly confidence: "medium" | "low";
      readonly ownerChain: readonly string[];
      readonly reason: string;
    };

declare global {
  interface Window {
    readonly __pickfixResolveElement: (element: Element) => RuntimeElementResolution;
  }
}

test.describe("global fix browser runtime", () => {
  test("served resolver unwraps memo and forwardRef component targets", async ({ page }) => {
    // Given: the served overlay client is loaded and a host element exposes React wrapper fibers.
    await page.goto("/");

    // When: the browser runtime resolves memo and forwardRef object targets from the served client script.
    const resolution = await page.evaluate(() => {
      const target = document.createElement("button");
      target.id = "runtime-wrapper-target";
      document.body.append(target);
      function MemoInner(): null {
        return null;
      }
      function ForwardInner(): null {
        return null;
      }
      Object.defineProperty(target, "__reactFiber$pickfix", {
        configurable: true,
        enumerable: true,
        value: {
          elementType: { type: MemoInner },
          return: {
            elementType: { render: ForwardInner },
            return: null,
          },
        },
      });
      return window.__pickfixResolveElement(target);
    });

    // Then: the actual browser runtime reports the unwrapped component labels.
    expect(resolution).toMatchObject({
      confidence: "medium",
      ownerChain: ["MemoInner", "ForwardInner"],
    });
  });

  test("browser fallback reaches context endpoint with safe module and prompts from endpoint context", async ({ page }) => {
    // Given: a selected browser element has no pickfix id but exposes a safe React debug source module.
    await page.goto("/");
    await activateOverlay(page);
    await page.evaluate(() => {
      const target = document.createElement("button");
      target.id = "module-fallback-target";
      target.textContent = "Module fallback target";
      document.body.append(target);
      function SourceFallback(): null {
        return null;
      }
      Object.defineProperty(target, "__reactFiber$pickfix", {
        configurable: true,
        enumerable: true,
        value: {
          _debugSource: { fileName: "/src/App.tsx" },
          elementType: SourceFallback,
          return: null,
        },
      });
    });

    // When: the element is selected and the user generates a prompt from the endpoint-provided fallback context.
    const contextResponse = page.waitForResponse((response) => {
      const url = new URL(response.url());
      return url.pathname === "/__pickfix/context" && url.searchParams.get("module") === "/src/App.tsx";
    });
    await page.locator("#module-fallback-target").click();
    const response = await contextResponse;
    const responseUrl = new URL(response.url());
    await page.getByLabel("Notes").fill("Use endpoint fallback context.");
    await page.getByRole("button", { name: "Generate prompt" }).click();

    // Then: the served client used a generated valid id, low-confidence source context, and prompt generation succeeds.
    expect(response.status()).toBe(200);
    expect(responseUrl.searchParams.get("id")).toMatch(/^[a-z0-9_-]{8,96}$/i);
    await expect(page.locator("[data-pickfix-confidence]")).toHaveText("low");
    await expect(page.locator("[data-pickfix-source-location]")).toContainText("src/App.tsx");
    await expect(page.locator("[data-pickfix-prompt-output]")).toHaveValue(/src\/App\.tsx/);
  });

  test("served DOM snapshot omits credential form values before reaching context endpoint", async ({ page }) => {
    // Given: a selected component contains credential and non-secret form values.
    await page.goto("/");
    await page.getByTestId("function-component").evaluate((target) => {
      const form = document.createElement("form");
      form.className = "login-form";
      form.dataset["safe"] = "login";
      form.innerHTML = [
        '<input id="email" name="email" value="person@example.test" data-safe="email">',
        '<input id="pickfix-credential-password" class="password-field" type="password" autocomplete="current-password" value="hunter2">',
      ].join("");
      target.append(form);
    });
    await activateOverlay(page);

    // When: the component is selected and the browser requests context.
    const contextResponse = page.waitForResponse((response) => new URL(response.url()).pathname === "/__pickfix/context");
    await page.locator("#pickfix-credential-password").click();
    const response = await contextResponse;
    const domSnapshot = new URL(response.url()).searchParams.get("dom") ?? "";

    // Then: useful attributes are sent, but form values are stripped at collection time.
    expect(domSnapshot).toContain("login-form");
    expect(domSnapshot).toContain("data-safe");
    expect(domSnapshot).not.toContain("person@example.test");
    expect(domSnapshot).not.toContain("hunter2");
    expect(domSnapshot).not.toMatch(/\svalue=/i);
  });
});

async function activateOverlay(page: Page): Promise<void> {
  const toggle = page.locator("[data-pickfix-toggle]");
  if ((await toggle.getAttribute("aria-pressed")) !== "true") {
    await toggle.click();
  }
}

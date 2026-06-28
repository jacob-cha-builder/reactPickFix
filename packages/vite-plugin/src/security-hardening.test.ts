import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { afterEach, describe, expect, test } from "vitest";

import { bundleComponentContext } from "./context-bundler.js";
import { pickfix } from "./index.js";
import {
  cleanupSecurityFixtures,
  createFixtureRoot,
  fixtureContext,
  startDevServer,
  transformFixtureSource,
} from "./security-test-helpers.js";

describe("security hardening", () => {
  afterEach(async () => {
    await cleanupSecurityFixtures();
  });

  test("security hardening rejects 257kb prompt body", async () => {
    // Given: a dev server with pickfix endpoints enabled.
    const root = await createFixtureRoot();
    const devServer = await startDevServer(root, pickfix());
    const oversizedBody = "x".repeat(257 * 1024);

    // When: a prompt request body exceeds the 256 KB endpoint limit.
    const response = await fetch(`${devServer.origin}/__pickfix/prompt`, {
      body: oversizedBody,
      headers: { "content-type": "application/json" },
      method: "POST",
    });
    const body: unknown = await response.json();

    // Then: the endpoint rejects the request with a JSON 413 contract.
    expect(response.status).toBe(413);
    expect(body).toMatchObject({ code: "body_too_large", ok: false });
  });

  test("security hardening excludes binary files", async () => {
    // Given: a selected component imports a CSS path whose bytes are binary.
    const root = await createFixtureRoot();
    await writeFile(join(root, "src", "App.tsx"), 'import "./App.css";\nexport function App() { return <main />; }\n');
    await writeFile(join(root, "src", "App.css"), Buffer.from([0, 1, 2, 3, 255, 0, 10, 11]));

    // When: component context is bundled for the selected source.
    const context = await bundleComponentContext({
      baseContext: fixtureContext("src/App.tsx"),
      root,
    });

    // Then: binary style files are not included in the prompt context.
    expect(context.styles).not.toEqual(expect.arrayContaining([expect.objectContaining({ file: "src/App.css" })]));
  });

  test("security hardening disables endpoints when enabled false", async () => {
    // Given: two dev servers with pickfix disabled by boolean and by predicate.
    const disabledRoot = await createFixtureRoot();
    const predicateRoot = await createFixtureRoot();
    const disabledPlugin = pickfix({ enabled: false });
    const predicatePlugin = pickfix({ enabled: () => false });
    const disabledServer = await startDevServer(disabledRoot, disabledPlugin);
    const predicateServer = await startDevServer(predicateRoot, predicatePlugin);

    // When: their HTML and endpoint surfaces are requested.
    const disabledHtmlResponse = await fetch(`${disabledServer.origin}/`);
    const disabledHtml = await disabledHtmlResponse.text();
    const disabledHealthResponse = await fetch(`${disabledServer.origin}/__pickfix/health`);
    const predicateHtmlResponse = await fetch(`${predicateServer.origin}/`);
    const predicateHtml = await predicateHtmlResponse.text();
    const predicateHealthResponse = await fetch(`${predicateServer.origin}/__pickfix/health`);
    const disabledTransform = await transformFixtureSource(disabledPlugin, disabledRoot);
    const predicateTransform = await transformFixtureSource(predicatePlugin, predicateRoot);

    // Then: client injection, source transforms, and local endpoints are absent for both disabled forms.
    expect(disabledHtmlResponse.status).toBe(200);
    expect(disabledHtml).not.toContain("/__pickfix/client.js");
    expect(disabledTransform).not.toContain("data-pickfix-id");
    expect(disabledHealthResponse.status).toBe(404);
    expect(predicateHtmlResponse.status).toBe(200);
    expect(predicateHtml).not.toContain("/__pickfix/client.js");
    expect(predicateTransform).not.toContain("data-pickfix-id");
    expect(predicateHealthResponse.status).toBe(404);
  });

  test("security hardening keeps dynamic enabled predicate consistent after configure", async () => {
    // Given: a dev server whose enabled predicate is true during configureServer.
    const root = await createFixtureRoot();
    let active = true;
    const plugin = pickfix({ enabled: () => active });
    const devServer = await startDevServer(root, plugin);

    // When: the predicate flips false after the server lifecycle has been configured.
    active = false;
    const htmlResponse = await fetch(`${devServer.origin}/`);
    const html = await htmlResponse.text();
    const healthResponse = await fetch(`${devServer.origin}/__pickfix/health`);
    const transformed = await transformFixtureSource(plugin, root);

    // Then: every dev-server surface remains active for that server lifecycle.
    expect(htmlResponse.status).toBe(200);
    expect(html).toContain("/__pickfix/client.js");
    expect(healthResponse.status).toBe(200);
    expect(transformed).toContain("data-pickfix-id");
  });

});

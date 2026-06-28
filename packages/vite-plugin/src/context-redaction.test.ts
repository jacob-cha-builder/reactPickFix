import { mkdtemp, readFile, readdir, rm, symlink, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { build } from "vite";
import { afterEach, describe, expect, test } from "vitest";

import { bundleComponentContext } from "./context-bundler.js";
import { pickfix } from "./index.js";
import {
  cleanupSecurityFixtures,
  createFixtureRoot,
  findFirstPickfixId,
  fixtureContext,
  startDevServer,
  trackFixtureRoot,
  transformFixtureSource,
} from "./security-test-helpers.js";

describe("context redaction", () => {
  afterEach(async () => {
    await cleanupSecurityFixtures();
  });

  test("context endpoint redacts home directory from source style dom and package context", async () => {
    // Given: source, CSS, DOM, and package scripts include the current home directory as plain text.
    const root = await createFixtureRoot();
    const homeDirectory = homedir();
    const plugin = pickfix();
    const source = [
      'import "./App.css";',
      "export function App() {",
      `  const homePath = "${homeDirectory}/source-token";`,
      '  return <main className="home-redaction" data-testid="home-redaction">{homePath}</main>;',
      "}",
      "",
    ].join("\n");
    await writeFile(join(root, "src", "App.tsx"), source);
    await writeFile(join(root, "src", "App.css"), `.home-redaction::after { content: "${homeDirectory}/style-token"; }\n`);
    await writeFile(
      join(root, "package.json"),
      JSON.stringify({
        name: "fixture-safe",
        scripts: {
          test: `node ${homeDirectory}/script-token.js`,
        },
      }),
    );
    const devServer = await startDevServer(root, plugin);
    const transformed = await transformFixtureSource(plugin, root, source, "src/App.tsx");
    const selectionId = findFirstPickfixId(transformed);
    const domSnapshot = `<main data-path="${homeDirectory}/dom-token"><span>Home</span></main>`;

    // When: the real context endpoint returns JSON for the registered component.
    const response = await fetch(
      `${devServer.origin}/__pickfix/context?id=${selectionId}&dom=${encodeURIComponent(domSnapshot)}`,
    );
    const body: unknown = await response.json();
    const serializedBody = JSON.stringify(body);

    // Then: no string field in endpoint JSON leaks the home directory.
    expect(response.status).toBe(200);
    expect(serializedBody).not.toContain(homeDirectory);
    expect(serializedBody).toContain("[HOME]");
  });

  test("context endpoint redacts credential DOM values before prompt generation", async () => {
    // Given: the browser sends a DOM snapshot with credential and non-secret form values.
    const root = await createFixtureRoot();
    const plugin = pickfix();
    const source = [
      "export function App() {",
      '  return <form className="login-form" data-testid="login-form"><input type="password" /></form>;',
      "}",
      "",
    ].join("\n");
    await writeFile(join(root, "src", "App.tsx"), source);
    const devServer = await startDevServer(root, plugin);
    const transformed = await transformFixtureSource(plugin, root, source, "src/App.tsx");
    const selectionId = findFirstPickfixId(transformed);
    const domSnapshot = [
      '<form class="login-form" data-testid="login-form">',
      '<input id="email" name="email" value="person@example.test" data-safe="email">',
      '<input class="password-field" type="password" autocomplete="current-password" value="hunter2">',
      "</form>",
    ].join("");

    // When: context is fetched and then reused by the prompt endpoint.
    const contextResponse = await fetch(
      `${devServer.origin}/__pickfix/context?id=${selectionId}&dom=${encodeURIComponent(domSnapshot)}`,
    );
    const contextBody: unknown = await contextResponse.json();
    const promptResponse = await fetch(`${devServer.origin}/__pickfix/prompt`, {
      body: JSON.stringify({
        change: { notes: "Keep the safe form context." },
        selectionId,
        target: "generic",
      }),
      headers: { "content-type": "application/json" },
      method: "POST",
    });
    const promptBody: unknown = await promptResponse.json();
    const serialized = `${JSON.stringify(contextBody)}\n${JSON.stringify(promptBody)}`;

    // Then: both context JSON and generated prompt preserve safe attributes but omit form values.
    expect(contextResponse.status).toBe(200);
    expect(promptResponse.status).toBe(200);
    expect(serialized).toContain("login-form");
    expect(serialized).toContain("data-safe");
    expect(serialized).not.toContain("person@example.test");
    expect(serialized).not.toContain("hunter2");
    expect(serialized).not.toMatch(/\svalue=/i);
  });

  test("security path traversal redaction production leak", async () => {
    // Given: source is a symlink escaping the project root and package scripts contain fake secrets.
    const sentinelApiKey = ["sk", "security-sentinel"].join("-");
    const root = await createFixtureRoot();
    const outsideRoot = await mkdtemp(join(process.cwd(), ".tmp-pickfix-outside-"));
    trackFixtureRoot(outsideRoot);
    await writeFile(join(outsideRoot, "Outside.tsx"), "export function Outside() { return null; }\n");
    await rm(join(root, "src", "App.tsx"));
    await symlink(join(outsideRoot, "Outside.tsx"), join(root, "src", "App.tsx"));
    await writeFile(
      join(root, "package.json"),
      JSON.stringify({
        name: "fixture-safe",
        scripts: {
          test: `FAKE_API_KEY=${sentinelApiKey} process.env echo ok`,
        },
      }),
    );

    // When: context is bundled, then the same app is built for production.
    const context = await bundleComponentContext({
      baseContext: fixtureContext("src/App.tsx"),
      homeDirectory: "/Users/security-home",
      root,
    });
    await rm(join(root, "src", "App.tsx"));
    await writeFile(join(root, "src", "App.tsx"), 'document.querySelector("#root")?.append("Fixture");\n');
    const dist = join(root, "dist");
    await build({
      build: { outDir: dist },
      configFile: false,
      logLevel: "silent",
      plugins: [pickfix()],
      root,
    });
    const productionText = (await readDirectoryTexts(dist)).join("\n");

    // Then: escaped source is not read, fake secrets are redacted, and production output has no dev overlay strings.
    const scriptsText = JSON.stringify(context.packageScripts);
    expect(context.excerpt).toBe("");
    expect(context.imports).toEqual([]);
    expect(scriptsText).toContain("[REDACTED]");
    expect(scriptsText).not.toContain(sentinelApiKey);
    expect(scriptsText).not.toContain("process.env");
    expect(productionText).not.toMatch(/__pickfix|pickfix|overlay|inspector|react-grab|react-scan/);
    expect(findProductionDevTokenLeak(productionText)).toBeNull();
  });
});

function findProductionDevTokenLeak(text: string): RegExpMatchArray | null {
  return text.match(/__pickfix|data-pickfix-id|\/__pickfix\/client\.js|react-grab|react-scan|inspector|overlay/i);
}

async function readDirectoryTexts(directory: string): Promise<string[]> {
  const texts: string[] = [];
  const entries = await readdir(directory, { withFileTypes: true });
  for (const entry of entries) {
    const entryPath = join(directory, entry.name);
    if (entry.isDirectory()) {
      texts.push(...(await readDirectoryTexts(entryPath)));
    } else if (entry.isFile()) {
      texts.push(await readFile(entryPath, "utf8"));
    }
  }

  return texts;
}

import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { afterEach, describe, expect, test } from "vitest";

import { pickfix } from "./index.js";
import { cleanupSecurityFixtures, createFixtureRoot, startDevServer } from "./security-test-helpers.js";

describe("context endpoint fallback", () => {
  afterEach(async () => {
    await cleanupSecurityFixtures();
  });

  test("context endpoint returns low confidence context for safe module fallback", async () => {
    // Given: a pickfix dev endpoint receives a valid selection id that has no registered source metadata.
    const root = await createFixtureRoot();
    const fallbackSource = 'export function FallbackOnly() { return <main className="fallback-only">Fallback</main>; }\n';
    await writeFile(join(root, "src", "FallbackOnly.tsx"), fallbackSource);
    const devServer = await startDevServer(root, pickfix());
    const moduleId = `/@fs/${join(root, "src", "FallbackOnly.tsx")}`;

    // When: the context endpoint is called with a root-contained module fallback.
    const response = await fetch(
      `${devServer.origin}/__pickfix/context?id=fallback01&module=${encodeURIComponent(moduleId)}`,
    );
    const body: unknown = await response.json();

    // Then: the production endpoint returns bundled low-confidence context for that source file.
    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      confidence: "low",
      excerpt: expect.stringContaining("FallbackOnly"),
      ok: true,
      source: {
        componentName: "Unmapped source",
        file: "src/FallbackOnly.tsx",
      },
    });
  });

  test("context endpoint rejects unsafe fallback modules", async () => {
    // Given: a pickfix dev endpoint receives fallback modules outside the safe project source surface.
    const root = await createFixtureRoot();
    const devServer = await startDevServer(root, pickfix());
    const unsafeModules = ["../secrets.tsx", "/src/../secrets.tsx", "/node_modules/pkg/index.tsx"] as const;

    // When: each unsafe module fallback is requested.
    const responses = await Promise.all(
      unsafeModules.map((moduleId) =>
        fetch(`${devServer.origin}/__pickfix/context?id=fallback01&module=${encodeURIComponent(moduleId)}`),
      ),
    );

    // Then: none of those hints can produce a low-confidence source context.
    expect(responses.map((response) => response.status)).toEqual([404, 404, 404]);
  });
});

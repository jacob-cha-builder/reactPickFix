import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import {
  createServer as createHttpServer,
  request as createRequest,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";
import type { AddressInfo } from "node:net";
import { join } from "node:path";
import { build, createServer, type ViteDevServer } from "vite";
import { afterEach, describe, expect, test } from "vitest";

import { pickfix } from "./index";

type StartedServer = {
  readonly origin: string;
  readonly vite: ViteDevServer;
  readonly close: () => Promise<void>;
};

const activeServers: StartedServer[] = [];
const activeRoots: string[] = [];

describe("pickfix dev server", () => {
  afterEach(async () => {
    const servers = activeServers.splice(0);
    await Promise.all(servers.map((server) => server.close()));

    const roots = activeRoots.splice(0);
    await Promise.all(roots.map((root) => rm(root, { recursive: true, force: true })));
  });

  test("dev-only injection endpoints", async () => {
    // Given: a Vite app with the pickfix plugin running in dev middleware mode.
    const root = await createFixtureRoot();
    const devServer = await startDevServer(root);

    // When: the root HTML and local endpoint surface are requested.
    const htmlResponse = await fetch(`${devServer.origin}/`);
    const html = await htmlResponse.text();
    const healthResponse = await fetch(`${devServer.origin}/__pickfix/health`);
    const health = await healthResponse.json();
    const methodResponse = await fetch(`${devServer.origin}/__pickfix/health`, { method: "POST" });
    const originResponse = await fetch(`${devServer.origin}/__pickfix/health`, {
      headers: { origin: "http://malicious.test" },
    });
    const hostResponse = await requestWithHost(devServer.origin, "/__pickfix/health", "example.test");
    const oversizedResponse = await fetch(`${devServer.origin}/__pickfix/prompt`, {
      body: JSON.stringify({
        selectionId: "abcdefgh",
        change: { notes: "x".repeat(256 * 1024 + 1) },
        target: "generic",
      }),
      headers: { "content-type": "application/json" },
      method: "POST",
    });
    const invalidJsonResponse = await fetch(`${devServer.origin}/__pickfix/prompt`, {
      body: "{",
      headers: { "content-type": "application/json" },
      method: "POST",
    });
    const invalidIdResponse = await fetch(`${devServer.origin}/__pickfix/context?id=../secrets`, {
      headers: { origin: devServer.origin },
    });
    const dist = join(root, "dist");
    await build({
      build: { outDir: dist },
      configFile: false,
      logLevel: "silent",
      plugins: [pickfix()],
      root,
    });
    const builtHtml = await readFile(join(dist, "index.html"), "utf8");

    // Then: dev injects only the bootstrap and guarded endpoint responses stay JSON.
    expect(htmlResponse.status).toBe(200);
    expect(html).toContain("/__pickfix/client.js");
    expect(healthResponse.status).toBe(200);
    expect(health).toEqual({ ok: true, rootSafe: true, version: "0.1.0" });
    expect(methodResponse.status).toBe(400);
    expect(await methodResponse.json()).toMatchObject({ ok: false, code: "invalid_method" });
    expect(originResponse.status).toBe(403);
    expect(await originResponse.json()).toMatchObject({ ok: false, code: "forbidden_origin" });
    expect(hostResponse.statusCode).toBe(403);
    expect(hostResponse.body).toContain("\"code\":\"forbidden_host\"");
    expect(oversizedResponse.status).toBe(413);
    expect(await oversizedResponse.json()).toMatchObject({ ok: false, code: "body_too_large" });
    expect(invalidJsonResponse.status).toBe(400);
    expect(await invalidJsonResponse.json()).toMatchObject({ ok: false, code: "invalid_json" });
    expect(invalidIdResponse.status).toBe(400);
    expect(await invalidIdResponse.json()).toMatchObject({ ok: false, code: "invalid_selection_id" });
    expect(builtHtml).not.toContain("__pickfix");
    expect(builtHtml).not.toContain("pickfix");
  });

  test("dev server rejects dns hostnames that impersonate ipv4 loopback", async () => {
    // Given: a Pickfix dev endpoint running on loopback.
    const root = await createFixtureRoot();
    const devServer = await startDevServer(root);

    // When: requests use DNS names that only start with the 127. loopback prefix.
    const longHostResponse = await requestWithHost(devServer.origin, "/__pickfix/health", "127.0.0.1.evil.test");
    const shortHostResponse = await requestWithHost(devServer.origin, "/__pickfix/health", "127.evil.test");
    const malformedHostResponse = await requestWithHost(devServer.origin, "/__pickfix/health", "127.0.0.999");
    const sameOriginImpersonatorResponse = await requestWithHost(
      devServer.origin,
      "/__pickfix/health",
      "127.0.0.1.evil.test",
      "http://127.0.0.1.evil.test",
    );
    const loopback127Response = await requestWithHost(devServer.origin, "/__pickfix/health", "127.0.0.1");
    const loopbackSubnetResponse = await requestWithHost(devServer.origin, "/__pickfix/health", "127.1.2.3");
    const localhostResponse = await requestWithHost(devServer.origin, "/__pickfix/health", "LOCALHOST");
    const ipv6LoopbackResponse = await requestWithHost(devServer.origin, "/__pickfix/health", "[::1]");

    // Then: only loopback IP literals and localhost reach the endpoint.
    expect(longHostResponse).toMatchObject({ statusCode: 403 });
    expect(longHostResponse.body).toContain("\"code\":\"forbidden_host\"");
    expect(shortHostResponse).toMatchObject({ statusCode: 403 });
    expect(shortHostResponse.body).toContain("\"code\":\"forbidden_host\"");
    expect(malformedHostResponse).toMatchObject({ statusCode: 403 });
    expect(malformedHostResponse.body).toContain("\"code\":\"forbidden_host\"");
    expect(sameOriginImpersonatorResponse).toMatchObject({ statusCode: 403 });
    expect(sameOriginImpersonatorResponse.body).toContain("\"code\":\"forbidden_host\"");
    expect(loopback127Response).toMatchObject({ statusCode: 200 });
    expect(loopbackSubnetResponse).toMatchObject({ statusCode: 200 });
    expect(localhostResponse).toMatchObject({ statusCode: 200 });
    expect(ipv6LoopbackResponse).toMatchObject({ statusCode: 200 });
  });
});

async function createFixtureRoot(): Promise<string> {
  const root = await mkdtemp(join(process.cwd(), ".tmp-pickfix-vite-plugin-"));
  activeRoots.push(root);
  await writeFile(
    join(root, "index.html"),
    '<!doctype html><html><head><title>Fixture</title></head><body><div id="root"></div><script type="module" src="/src/main.ts"></script></body></html>',
  );
  await mkdir(join(root, "src"));
  await writeFile(join(root, "src", "main.ts"), 'document.querySelector("#root")?.append("Fixture");\n');
  return root;
}

async function startDevServer(root: string): Promise<StartedServer> {
  const vite = await createServer({
    appType: "spa",
    configFile: false,
    logLevel: "silent",
    plugins: [pickfix()],
    root,
    server: { allowedHosts: true, middlewareMode: true },
  });
  const httpServer = createHttpServer((request: IncomingMessage, response: ServerResponse) => {
    vite.middlewares(request, response, () => {
      response.statusCode = 404;
      response.end();
    });
  });

  await new Promise<void>((resolve) => {
    httpServer.listen(0, "127.0.0.1", resolve);
  });

  const address = httpServer.address();
  if (address === null || typeof address === "string") {
    throw new Error("Vite middleware test server did not expose a TCP address");
  }

  const startedServer = {
    origin: `http://127.0.0.1:${getPort(address)}`,
    vite,
    close: async () => {
      await vite.close();
      await new Promise<void>((resolve, reject) => {
        httpServer.close((error) => {
          if (error === undefined) {
            resolve();
            return;
          }
          reject(error);
        });
      });
    },
  };
  activeServers.push(startedServer);
  return startedServer;
}

function getPort(address: AddressInfo): number {
  return address.port;
}

function requestWithHost(
  origin: string,
  path: string,
  host: string,
  requestOrigin?: string,
): Promise<{ readonly statusCode: number; readonly body: string }> {
  const url = new URL(path, origin);
  const headers = requestOrigin === undefined ? { host } : { host, origin: requestOrigin };

  return new Promise((resolve, reject) => {
    const request = createRequest(
      {
        headers,
        hostname: url.hostname,
        method: "GET",
        path: `${url.pathname}${url.search}`,
        port: url.port,
      },
      (response) => {
      response.setEncoding("utf8");
      let body = "";
      response.on("data", (chunk: string) => {
        body += chunk;
      });
      response.on("end", () => {
        resolve({ body, statusCode: response.statusCode ?? 0 });
      });
      },
    );

    request.on("error", reject);
    request.end();
  });
}

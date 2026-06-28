import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { createServer as createHttpServer, type IncomingMessage, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { join } from "node:path";
import type { ComponentContext } from "@pickfix/shared";
import { type Plugin, createServer, type ViteDevServer } from "vite";

export type StartedServer = {
  readonly origin: string;
  readonly vite: ViteDevServer;
  readonly close: () => Promise<void>;
};

const activeServers: StartedServer[] = [];
const activeRoots: string[] = [];

export async function cleanupSecurityFixtures(): Promise<void> {
  const servers = activeServers.splice(0);
  await Promise.all(servers.map((server) => server.close()));

  const roots = activeRoots.splice(0);
  await Promise.all(roots.map((root) => rm(root, { recursive: true, force: true })));
}

export async function createFixtureRoot(): Promise<string> {
  const root = await mkdtemp(join(process.cwd(), ".tmp-pickfix-security-"));
  activeRoots.push(root);
  await writeFile(
    join(root, "index.html"),
    '<!doctype html><html><body><div id="root"></div><script type="module" src="/src/App.tsx"></script></body></html>',
  );
  await mkdir(join(root, "src"));
  await writeFile(join(root, "src", "App.tsx"), 'document.querySelector("#root")?.append("Fixture");\n');
  return root;
}

export function trackFixtureRoot(root: string): void {
  activeRoots.push(root);
}

export async function startDevServer(root: string, plugin: Plugin): Promise<StartedServer> {
  const vite = await createServer({
    appType: "spa",
    configFile: false,
    logLevel: "silent",
    plugins: [plugin],
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
    origin: `http://127.0.0.1:${address.port}`,
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

export async function transformFixtureSource(
  plugin: Plugin,
  root: string,
  source = "export function App() { return <main><button>Fixture</button></main>; }\n",
  file = "src/Probe.tsx",
): Promise<string> {
  const transform = plugin.transform;
  if (typeof transform !== "function") {
    throw new Error("Pickfix test plugin did not expose a transform hook");
  }

  const result: unknown = await Reflect.apply(transform, {}, [source, join(root, file)]);
  if (typeof result === "string") {
    return result;
  }

  if (typeof result === "object" && result !== null && "code" in result && typeof result.code === "string") {
    return result.code;
  }

  return "";
}

export function findFirstPickfixId(code: string): string {
  const id = code.match(/data-pickfix-id="([^"]+)"/)?.[1];
  if (id === undefined) {
    throw new Error("Transformed fixture did not include a pickfix id");
  }
  return id;
}

export function fixtureContext(file: string): ComponentContext {
  return {
    confidence: "high",
    domSnapshot: "",
    excerpt: "",
    imports: [],
    limits: {
      domBytes: 0,
      domNodes: 0,
      excerptBytes: 0,
      excerptLines: 0,
    },
    ok: true,
    ownerChain: ["App"],
    packageScripts: [],
    selectionId: "security01",
    source: {
      column: 0,
      componentName: "App",
      file,
      id: "security01",
      line: 1,
    },
    styles: [],
    verificationCommands: [],
  };
}

import type { IncomingMessage, ServerResponse } from "node:http";
import { homedir } from "node:os";
import type { ViteDevServer } from "vite";

import { buildPromptBundle, PromptIntentSchema } from "@pickfix/shared";
import type { ComponentContext, PromptBundle } from "@pickfix/shared";

import { bundleComponentContext } from "./context-bundler.js";
import { resolveRegisteredContext } from "./server-registry.js";
import { resolveLowConfidenceContext } from "./source-resolver.js";

const maxBodyBytes = 256 * 1024;
const selectionIdPattern = /^[a-z0-9_-]{8,96}$/i;

type JsonValue = string | number | boolean | null | readonly JsonValue[] | { readonly [key: string]: JsonValue };

type BodyReadResult =
  | { readonly kind: "ok"; readonly body: string }
  | { readonly kind: "too_large" }
  | { readonly kind: "read_error" };

const promptContextCache = new WeakMap<ViteDevServer, Map<string, ComponentContext>>();

export async function writeContextEndpoint(
  server: ViteDevServer,
  response: ServerResponse,
  method: string | undefined,
  url: URL,
): Promise<void> {
  if (method !== "GET") {
    writeJsonError(response, 400, "invalid_method", "Expected GET");
    return;
  }

  const selectionId = url.searchParams.get("id");
  if (selectionId === null || !selectionIdPattern.test(selectionId)) {
    writeJsonError(response, 400, "invalid_selection_id", "Invalid selection id");
    return;
  }

  const baseContext = resolveRegisteredContext(server, selectionId) ?? fallbackContextFromModule(server, selectionId, url);
  if (baseContext === undefined) {
    writeJsonError(response, 404, "not_found", "No component context is registered for this selection id");
    return;
  }

  const domSnapshot = url.searchParams.get("dom");
  const homeDirectory = homedir();
  const contextInput =
    domSnapshot === null
      ? { baseContext, homeDirectory, root: server.config.root }
      : { baseContext, domSnapshot, homeDirectory, root: server.config.root };
  const context = await bundleComponentContext(contextInput);
  cacheContext(server, context);
  writeJson(response, 200, context);
}

export async function writePromptEndpoint(
  server: ViteDevServer,
  response: ServerResponse,
  request: IncomingMessage,
): Promise<void> {
  if (request.method !== "POST") {
    writeJsonError(response, 400, "invalid_method", "Expected POST");
    return;
  }

  const body = await readBody(request);
  if (body.kind === "too_large") {
    writeJsonError(response, 413, "body_too_large", "Request body exceeds 256 KB");
    return;
  }
  if (body.kind === "read_error") {
    writeJsonError(response, 400, "invalid_payload", "Request body could not be read");
    return;
  }

  const parsedJson = parseJson(body.body);
  if (!parsedJson.ok) {
    writeJsonError(response, 400, "invalid_json", "Request body must be valid JSON");
    return;
  }

  const intent = PromptIntentSchema.safeParse(parsedJson.value);
  if (!intent.success) {
    writeJsonError(response, 400, "invalid_payload", "Request body does not match PromptIntent");
    return;
  }

  const context = contextForPrompt(server, intent.data.selectionId);
  if (context === undefined) {
    writeJsonError(response, 404, "not_found", "No prompt context is registered for this selection id");
    return;
  }

  writeJson(
    response,
    200,
    promptBundleToJson(
      buildPromptBundle({
        context,
        homeDirectory: homedir(),
        intent: intent.data,
      }),
    ),
  );
}

function promptBundleToJson(bundle: PromptBundle): JsonValue {
  const baseBundle = {
    ok: bundle.ok,
    prompt: bundle.prompt,
    summary: bundle.summary,
    target: bundle.target,
    warnings: bundle.warnings,
  };

  if (bundle.command === undefined) {
    return baseBundle;
  }

  return {
    ...baseBundle,
    command: bundle.command,
  };
}

function fallbackContextFromModule(
  server: ViteDevServer,
  selectionId: string,
  url: URL,
): ComponentContext | undefined {
  const moduleId = url.searchParams.get("module");
  if (moduleId === null) {
    return undefined;
  }

  return resolveLowConfidenceContext({
    moduleId,
    root: server.config.root,
    selectionId,
  });
}

function cacheContext(server: ViteDevServer, context: ComponentContext): void {
  const existingCache = promptContextCache.get(server);
  if (existingCache === undefined) {
    promptContextCache.set(server, new Map([[context.selectionId, context]]));
    return;
  }

  existingCache.set(context.selectionId, context);
}

function contextForPrompt(server: ViteDevServer, selectionId: string): ComponentContext | undefined {
  return promptContextCache.get(server)?.get(selectionId);
}

function parseJson(body: string): { readonly ok: true; readonly value: unknown } | { readonly ok: false } {
  try {
    const value: unknown = JSON.parse(body);
    return { ok: true, value };
  } catch (error) {
    if (error instanceof SyntaxError) {
      return { ok: false };
    }
    throw error;
  }
}

function readBody(request: IncomingMessage): Promise<BodyReadResult> {
  return new Promise((resolve) => {
    let size = 0;
    let tooLarge = false;
    const chunks: Buffer[] = [];

    request.on("data", (chunk: Buffer) => {
      size += chunk.length;
      if (size > maxBodyBytes) {
        tooLarge = true;
        return;
      }

      chunks.push(chunk);
    });

    request.on("end", () => {
      if (tooLarge) {
        resolve({ kind: "too_large" });
        return;
      }

      resolve({ body: Buffer.concat(chunks).toString("utf8"), kind: "ok" });
    });

    request.on("error", () => {
      resolve({ kind: "read_error" });
    });
  });
}

function writeJsonError(
  response: ServerResponse,
  statusCode: 400 | 403 | 404 | 413,
  code:
    | "body_too_large"
    | "invalid_json"
    | "invalid_method"
    | "invalid_payload"
    | "invalid_selection_id"
    | "not_found",
  message: string,
): void {
  writeJson(response, statusCode, { code, message, ok: false });
}

function writeJson(response: ServerResponse, statusCode: number, body: JsonValue): void {
  response.statusCode = statusCode;
  response.setHeader("content-type", "application/json; charset=utf-8");
  response.end(JSON.stringify(body));
}

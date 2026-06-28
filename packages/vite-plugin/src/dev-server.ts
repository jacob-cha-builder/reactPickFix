import type { IncomingMessage, ServerResponse } from "node:http";
import { normalize, parse } from "node:path";
import type { ViteDevServer } from "vite";

import { pickfixClientScript } from "./client-script.js";
import { writeContextEndpoint, writePromptEndpoint } from "./prompt-endpoints.js";

const pluginVersion = "0.1.0";

export const clientPath = "/__pickfix/client.js";

type JsonValue = string | number | boolean | null | readonly JsonValue[] | { readonly [key: string]: JsonValue };

type PickfixErrorCode =
  | "body_too_large"
  | "forbidden_host"
  | "forbidden_origin"
  | "invalid_json"
  | "invalid_method"
  | "invalid_payload"
  | "invalid_selection_id"
  | "not_found";

export async function handlePickfixRequest(
  server: ViteDevServer,
  request: IncomingMessage,
  response: ServerResponse,
): Promise<void> {
  const rootSafe = isRootSafe(server.config.root);
  const hostDecision = validateHost(request);
  if (!hostDecision.valid) {
    writeJsonError(response, 403, "forbidden_host", "Pickfix endpoints accept loopback hosts only");
    return;
  }

  if (!validateOrigin(request, hostDecision.host)) {
    writeJsonError(response, 403, "forbidden_origin", "Pickfix endpoints accept same-origin requests only");
    return;
  }

  const url = new URL(request.url ?? "/", `http://${hostDecision.host}`);
  if (url.pathname === clientPath) {
    writeClient(response, request.method);
    return;
  }

  if (url.pathname === "/__pickfix/health") {
    writeHealth(response, request.method, rootSafe);
    return;
  }

  if (url.pathname === "/__pickfix/context") {
    await writeContextEndpoint(server, response, request.method, url);
    return;
  }

  if (url.pathname === "/__pickfix/prompt") {
    await writePromptEndpoint(server, response, request);
    return;
  }

  writeJsonError(response, 404, "not_found", "Unknown pickfix endpoint");
}

export function getRequestPath(request: IncomingMessage): string {
  return new URL(request.url ?? "/", "http://localhost").pathname;
}

export function writeJsonError(
  response: ServerResponse,
  statusCode: 400 | 403 | 404 | 413,
  code: PickfixErrorCode,
  message: string,
): void {
  writeJson(response, statusCode, { code, message, ok: false });
}

function writeClient(response: ServerResponse, method: string | undefined): void {
  if (method !== "GET") {
    writeJsonError(response, 400, "invalid_method", "Expected GET");
    return;
  }

  response.statusCode = 200;
  response.setHeader("content-type", "application/javascript; charset=utf-8");
  response.end(pickfixClientScript);
}

function writeHealth(response: ServerResponse, method: string | undefined, rootSafe: boolean): void {
  if (method !== "GET") {
    writeJsonError(response, 400, "invalid_method", "Expected GET");
    return;
  }

  writeJson(response, 200, { ok: true, rootSafe, version: pluginVersion });
}

function validateHost(request: IncomingMessage): { readonly valid: true; readonly host: string } | { readonly valid: false } {
  const host = getSingleHeader(request.headers.host);
  if (host === undefined) {
    return { valid: false };
  }

  const hostname = parseHostName(host);
  if (hostname === undefined || !isLoopbackHost(hostname)) {
    return { valid: false };
  }

  return { host, valid: true };
}

function validateOrigin(request: IncomingMessage, host: string): boolean {
  const originHeader = getSingleHeader(request.headers.origin);
  if (originHeader === undefined) {
    return true;
  }

  const origin = parseUrl(originHeader);
  if (origin === undefined) {
    return false;
  }

  return origin.host.toLowerCase() === host.toLowerCase() && isLoopbackHost(origin.hostname);
}

function parseUrl(value: string): URL | undefined {
  try {
    return new URL(value);
  } catch (error) {
    if (error instanceof TypeError) {
      return undefined;
    }
    throw error;
  }
}

function getSingleHeader(header: string | string[] | undefined): string | undefined {
  if (Array.isArray(header)) {
    return header[0];
  }

  return header;
}

function parseHostName(host: string): string | undefined {
  if (host.startsWith("[")) {
    const closingBracketIndex = host.indexOf("]");
    if (closingBracketIndex < 0) {
      return undefined;
    }

    return host.slice(1, closingBracketIndex);
  }

  const colonIndex = host.indexOf(":");
  if (colonIndex < 0) {
    return host;
  }

  return host.slice(0, colonIndex);
}

function isLoopbackHost(hostname: string): boolean {
  const normalizedHost = hostname.toLowerCase();
  const host =
    normalizedHost.startsWith("[") && normalizedHost.endsWith("]") ? normalizedHost.slice(1, -1) : normalizedHost;
  if (host === "localhost" || host === "::1") {
    return true;
  }

  const octets = host.split(".");
  if (octets.length !== 4 || octets[0] !== "127") {
    return false;
  }

  return octets.every((octet) => {
    if (!/^\d+$/.test(octet)) {
      return false;
    }

    const value = Number(octet);
    return String(value) === octet && value >= 0 && value <= 255;
  });
}

function isRootSafe(root: string): boolean {
  const normalizedRoot = normalize(root);
  return normalizedRoot.length > 0 && normalizedRoot !== parse(normalizedRoot).root;
}

function writeJson(response: ServerResponse, statusCode: number, body: JsonValue): void {
  response.statusCode = statusCode;
  response.setHeader("content-type", "application/json; charset=utf-8");
  response.end(JSON.stringify(body));
}

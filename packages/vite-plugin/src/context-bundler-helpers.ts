import { readFile, realpath } from "node:fs/promises";
import { isAbsolute, relative, resolve, sep } from "node:path";

import { excludeReadablePath, redactSensitiveText } from "@pickfix/shared";

const maxDomNodes = 20;
const maxJsonBytes = 256 * 1024;

export type LimitedText = {
  readonly bytes: number;
  readonly lines: number;
  readonly text: string;
};

export function limitDomSnapshot(text: string, maxBytes: number): LimitedText {
  const limitedNodes = domSnapshotNodes(text).slice(0, maxDomNodes).join("");
  const limited = limitText(limitedNodes, maxBytes, maxDomNodes);
  return {
    ...limited,
    lines: countDomSnapshotNodes(limited.text),
  };
}

export function limitText(text: string, maxBytes: number, maxLines: number): LimitedText {
  const lineLimited = text.split(/\r?\n/).slice(0, maxLines).join("\n");
  let byteLimited = lineLimited;
  while (Buffer.byteLength(byteLimited, "utf8") > maxBytes) {
    byteLimited = byteLimited.slice(0, Math.max(0, byteLimited.length - 256));
  }

  const redactedText = redactSensitiveText(byteLimited);
  return {
    bytes: Buffer.byteLength(redactedText, "utf8"),
    lines: redactedText.length === 0 ? 0 : redactedText.split(/\r?\n/).length,
    text: redactedText,
  };
}

export function emptyLimitedText(): LimitedText {
  return { bytes: 0, lines: 0, text: "" };
}

export async function readProjectText(root: string, file: string): Promise<string | undefined> {
  const absolutePath = projectAbsolutePath(root, file);
  if (absolutePath === undefined) {
    return undefined;
  }

  try {
    const rootRealPath = await realpath(root);
    const fileRealPath = await realpath(absolutePath);
    if (!isContainedPath(rootRealPath, fileRealPath)) {
      return undefined;
    }

    const bytes = await readFile(fileRealPath);
    if (isLikelyBinary(bytes)) {
      return undefined;
    }

    return bytes.toString("utf8");
  } catch (error) {
    if (isNodeErrorCode(error, "ENOENT") || isNodeErrorCode(error, "EISDIR")) {
      return undefined;
    }
    throw error;
  }
}

export function projectRelativePath(root: string, absolutePath: string): string | undefined {
  const relativePath = relative(resolve(root), absolutePath).split(sep).join("/");
  if (!excludeReadablePath(relativePath).readable) {
    return undefined;
  }

  return relativePath;
}

export function parseJsonObject(text: string): Readonly<Record<string, unknown>> | undefined {
  if (Buffer.byteLength(text, "utf8") > maxJsonBytes) {
    return undefined;
  }

  try {
    const parsed: unknown = JSON.parse(text);
    return isRecord(parsed) ? parsed : undefined;
  } catch (error) {
    if (error instanceof SyntaxError) {
      return undefined;
    }
    throw error;
  }
}

export function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function countDomSnapshotNodes(text: string): number {
  return domSnapshotNodes(text).length;
}

function domSnapshotNodes(text: string): string[] {
  return [...text.matchAll(/<[A-Za-z][^>]*>(?:[^<]*<\/[A-Za-z][^>]*>)?/g)]
    .map((match) => match[0] ?? "")
    .filter((node) => node.length > 0);
}

function projectAbsolutePath(root: string, file: string): string | undefined {
  if (!excludeReadablePath(file).readable) {
    return undefined;
  }

  const absolutePath = resolve(root, file);
  const relativePath = relative(resolve(root), absolutePath);
  if (relativePath === "" || relativePath.startsWith("..") || isAbsolute(relativePath)) {
    return undefined;
  }

  return absolutePath;
}

function isContainedPath(root: string, file: string): boolean {
  const relativePath = relative(root, file);
  return relativePath !== "" && !relativePath.startsWith("..") && !isAbsolute(relativePath);
}

function isLikelyBinary(bytes: Buffer): boolean {
  if (bytes.length === 0) {
    return false;
  }

  if (bytes.includes(0)) {
    return true;
  }

  let controlBytes = 0;
  for (const byte of bytes.subarray(0, Math.min(bytes.length, 1024))) {
    if (byte < 32 && byte !== 9 && byte !== 10 && byte !== 13) {
      controlBytes += 1;
    }
  }

  return controlBytes / Math.min(bytes.length, 1024) > 0.1;
}

function isNodeErrorCode(error: unknown, code: string): boolean {
  if (typeof error !== "object" || error === null) {
    return false;
  }

  return Reflect.get(error, "code") === code;
}

import { resolve, sep } from "node:path";

import type { ComponentContext } from "@pickfix/shared";

import { projectRelativePath } from "./context-bundler-helpers.js";
import { createContext } from "./metadata-registry.js";

export function resolveLowConfidenceContext(options: {
  readonly moduleId: string;
  readonly selectionId: string;
  readonly root?: string;
}): ComponentContext | undefined {
  const file = normalizeFallbackFile(options.moduleId, options.root);
  if (file === undefined) {
    return undefined;
  }

  return createContext(
    options.selectionId,
    {
      column: 0,
      componentName: "Unmapped source",
      file,
      line: 1,
    },
    "low",
    [],
  );
}

function normalizeFallbackFile(moduleId: string, root: string | undefined): string | undefined {
  const withoutQuery = moduleId.split("?")[0] ?? moduleId;
  if (!isSafeFallbackModuleId(withoutQuery)) {
    return undefined;
  }

  const normalized = withoutQuery.split(sep).join("/");

  if (root === undefined) {
    return stripLeadingSlash(normalized);
  }

  const absolutePath = moduleAbsolutePath(normalized, root);
  if (absolutePath === undefined) {
    return undefined;
  }

  return projectRelativePath(root, absolutePath);
}

function moduleAbsolutePath(moduleId: string, root: string): string | undefined {
  if (moduleId.startsWith("/@fs/")) {
    return moduleId.slice(4);
  }

  if (moduleId.startsWith("/")) {
    return resolve(root, stripLeadingSlash(moduleId));
  }

  return resolve(root, moduleId);
}

function stripLeadingSlash(value: string): string {
  return value.startsWith("/") ? value.slice(1) : value;
}

function isSafeFallbackModuleId(moduleId: string): boolean {
  const normalized = moduleId.split(sep).join("/");
  if (normalized.length === 0 || normalized.includes("\0") || /^[a-z][a-z0-9+.-]*:/i.test(normalized)) {
    return false;
  }
  if (!/\.[cm]?[jt]sx?$/.test(normalized)) {
    return false;
  }

  const segments = normalized.split("/").filter((segment) => segment.length > 0);
  return !segments.some((segment) => segment === "." || segment === ".." || segment === "node_modules");
}

import { existsSync } from "node:fs";
import { describe, expect, test } from "vitest";

const requiredPaths = [
  "package.json",
  "tsconfig.base.json",
  ".gitignore",
  "packages/vite-plugin",
  "packages/vite-plugin/package.json",
  "packages/vite-plugin/src",
  "packages/overlay",
  "packages/overlay/package.json",
  "packages/overlay/src",
  "packages/shared",
  "packages/shared/package.json",
  "packages/shared/src",
  "examples/vite-react",
  "examples/vite-react/package.json",
  "examples/vite-react/src",
  "tests",
];

const forbiddenPaths = [
  "pnpm-workspace.yaml",
  "yarn.lock",
  "bun.lock",
  "bun.lockb",
  "chrome-extension",
  "edge-extension",
  "extension",
  "packages/extension",
  "packages/chrome-extension",
  "packages/edge-extension",
];

describe("workspace smoke", () => {
  test("workspace smoke has required scaffold and excludes forbidden artifacts", () => {
    const missingPaths = requiredPaths.filter((requiredPath) => !existsSync(requiredPath));
    const presentForbiddenPaths = forbiddenPaths.filter((forbiddenPath) =>
      existsSync(forbiddenPath),
    );

    expect(missingPaths).toEqual([]);
    expect(presentForbiddenPaths).toEqual([]);
  });
});

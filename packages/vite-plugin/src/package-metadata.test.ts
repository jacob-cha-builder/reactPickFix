import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { describe, expect, test } from "vitest";

const execFileAsync = promisify(execFile);
const packageRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

type JsonObject = object;

describe("npm package metadata", () => {
  test("npm package metadata exports pickfix", async () => {
    // Given: the vite plugin package manifest is the npm publication contract.
    const packageJson = await readPackageJson();

    // When: consumers resolve the package entrypoint and types through package metadata.
    const exportsRoot = getJsonProperty(getJsonObject(getJsonProperty(packageJson, "exports")), ".");
    const rootExport = getJsonObject(exportsRoot);

    // Then: the package is public-ready and points consumers at built dist artifacts.
    expect(getJsonProperty(packageJson, "name")).toBe("@pickfix/vite-plugin");
    expect(getJsonProperty(packageJson, "version")).toBe("0.1.0");
    expect(getJsonProperty(packageJson, "type")).toBe("module");
    expect(getJsonProperty(packageJson, "private")).not.toBe(true);
    expect(getJsonProperty(rootExport, "import")).toBe("./dist/index.js");
    expect(getJsonProperty(rootExport, "types")).toBe("./dist/index.d.ts");
    expect(getJsonProperty(packageJson, "types")).toBe("./dist/index.d.ts");
    expect(getJsonProperty(getJsonObject(getJsonProperty(packageJson, "scripts")), "build")).toEqual(
      expect.stringContaining("dist"),
    );
    expect(getJsonProperty(getJsonObject(getJsonProperty(packageJson, "scripts")), "smoke:pack-install")).toEqual(
      expect.any(String),
    );
    const peerDependencies = getJsonObject(getJsonProperty(packageJson, "peerDependencies"));
    expectPeerSupports(peerDependencies, "vite", ["5.0.0", "6.0.0", "7.0.0", "8.0.0"]);
    expectPeerSupports(peerDependencies, "@vitejs/plugin-react", ["4.2.0", "5.0.0", "6.0.0"]);
    expectPeerSupports(peerDependencies, "react", ["18.0.0", "19.0.0"]);
    expectPeerSupports(peerDependencies, "react-dom", ["18.0.0", "19.0.0"]);
  });

  test("npm package files exclude workspace artifacts", async () => {
    // Given: npm's own dry-run pack list is the artifact boundary.
    const packedFiles = await packedFilePaths();

    // When: the package is packed for local verification.
    const forbiddenFiles = packedFiles.filter(
      (path) =>
        path.startsWith(".omo/") ||
        path.startsWith("examples/") ||
        path.includes("/tests/") ||
        path.includes(".test.") ||
        path.startsWith("src/") ||
        path.includes("evidence") ||
        path === ".env" ||
        path.startsWith(".env."),
    );

    // Then: only built distribution files and required package docs are included.
    expect(packedFiles).toContain("package.json");
    expect(packedFiles).toContain("README.md");
    expect(packedFiles).toContain("dist/index.js");
    expect(packedFiles).toContain("dist/index.d.ts");
    expect(packedFiles.some((path) => path.startsWith("dist/") && path.endsWith(".d.ts"))).toBe(true);
    expect(forbiddenFiles).toEqual([]);
  });
});

async function readPackageJson(): Promise<JsonObject> {
  const text = await readFile(join(packageRoot, "package.json"), "utf8");
  const parsed: unknown = JSON.parse(text);
  const packageJson = getJsonObject(parsed);
  if (packageJson === undefined) {
    throw new Error("package.json did not parse to an object");
  }
  return packageJson;
}

async function packedFilePaths(): Promise<readonly string[]> {
  const { stdout } = await execFileAsync("npm", ["pack", "--dry-run", "--json"], {
    cwd: packageRoot,
    maxBuffer: 1024 * 1024,
  });
  const parsed: unknown = JSON.parse(npmJsonOutput(stdout));
  if (!Array.isArray(parsed)) {
    throw new Error("npm pack --json did not return an array");
  }

  const packResult = getJsonObject(parsed[0]);
  const files = getJsonArray(getJsonProperty(packResult, "files"));
  if (files === undefined) {
    throw new Error("npm pack --json did not return a file list");
  }

  return files.map((file) => {
    const fileObject = getJsonObject(file);
    const path = getJsonProperty(fileObject, "path");
    if (typeof path !== "string") {
      throw new Error("npm pack file entry did not include a path string");
    }
    return path;
  });
}

function getJsonObject(value: unknown): JsonObject | undefined {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return undefined;
  }
  return value;
}

function getJsonArray(value: unknown): readonly unknown[] | undefined {
  return Array.isArray(value) ? value : undefined;
}

function getJsonProperty(value: JsonObject | undefined, key: string): unknown {
  if (value === undefined) {
    return undefined;
  }
  return Reflect.get(value, key);
}

function expectPeerSupports(peerDependencies: JsonObject | undefined, packageName: string, versions: readonly string[]): void {
  const peerRange = getJsonProperty(peerDependencies, packageName);
  if (typeof peerRange !== "string") {
    throw new Error(`${packageName} peer dependency must be a string`);
  }

  const unsupportedVersions = versions.filter((version) => !peerRangeSupports(peerRange, version));
  expect(unsupportedVersions).toEqual([]);
}

function peerRangeSupports(range: string, version: string): boolean {
  const parsedVersion = parseVersion(version);
  if (parsedVersion === undefined) {
    throw new Error(`Test version is not valid semver: ${version}`);
  }

  return range
    .split("||")
    .some((rangePart) => rangePart.trim().split(/\s+/).every((comparator) => comparatorSupports(comparator, parsedVersion)));
}

function comparatorSupports(comparator: string, version: Version): boolean {
  if (comparator.startsWith("^")) {
    const lowerBound = parseVersion(comparator.slice(1));
    return lowerBound !== undefined && compareVersions(version, lowerBound) >= 0 && version.major === lowerBound.major;
  }

  if (comparator.startsWith(">=")) {
    const lowerBound = parseVersion(comparator.slice(2));
    return lowerBound !== undefined && compareVersions(version, lowerBound) >= 0;
  }

  if (comparator.startsWith(">")) {
    const lowerBound = parseVersion(comparator.slice(1));
    return lowerBound !== undefined && compareVersions(version, lowerBound) > 0;
  }

  if (comparator.startsWith("<=")) {
    const upperBound = parseVersion(comparator.slice(2));
    return upperBound !== undefined && compareVersions(version, upperBound) <= 0;
  }

  if (comparator.startsWith("<")) {
    const upperBound = parseVersion(comparator.slice(1));
    return upperBound !== undefined && compareVersions(version, upperBound) < 0;
  }

  if (comparator === "*" || comparator.length === 0) {
    return true;
  }

  const exactVersion = parseVersion(comparator);
  return exactVersion !== undefined && compareVersions(version, exactVersion) === 0;
}

type Version = {
  readonly major: number;
  readonly minor: number;
  readonly patch: number;
};

function parseVersion(version: string): Version | undefined {
  const [majorText, minorText = "0", patchText = "0"] = version.split(".");
  const major = parseVersionPart(majorText);
  const minor = parseVersionPart(minorText);
  const patch = parseVersionPart(patchText);
  if (major === undefined || minor === undefined || patch === undefined) {
    return undefined;
  }

  return { major, minor, patch };
}

function parseVersionPart(value: string | undefined): number | undefined {
  if (value === undefined || !/^\d+$/.test(value)) {
    return undefined;
  }

  return Number(value);
}

function compareVersions(left: Version, right: Version): number {
  return left.major - right.major || left.minor - right.minor || left.patch - right.patch;
}

function npmJsonOutput(stdout: string): string {
  const jsonStart = stdout.indexOf("[\n");
  if (jsonStart < 0) {
    throw new Error("npm pack --json output did not include a JSON array");
  }
  return stdout.slice(jsonStart);
}

import { spawnSync } from "node:child_process";
import { cp, mkdir, mkdtemp, rm } from "node:fs/promises";
import { join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";

const packageRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const workspaceRoot = resolve(packageRoot, "../..");
const exampleRoot = resolve(workspaceRoot, "examples/vite-react");
const tempRoot = await createTempRoot();
const packDir = join(tempRoot, "pack");
const consumerRoot = join(tempRoot, "examples/vite-react");

try {
  await mkdir(join(tempRoot, "examples"), { recursive: true });
  await mkdir(packDir, { recursive: true });
  await cp(join(workspaceRoot, "tsconfig.base.json"), join(tempRoot, "tsconfig.base.json"));
  await cp(exampleRoot, consumerRoot, {
    filter: (source) => {
      const sourceRelativePath = relative(exampleRoot, source);
      return !excludedCopyPath(sourceRelativePath);
    },
    recursive: true,
  });

  runNpm(["run", "build"], packageRoot);
  const tarballName = runNpm(["pack", "--pack-destination", packDir], packageRoot).trim().split(/\r?\n/).at(-1);
  if (tarballName === undefined || tarballName.length === 0) {
    throw new Error("npm pack did not print a tarball name");
  }

  const tarballPath = join(packDir, tarballName);
  console.log(`pack tarball: ${tarballPath}`);
  console.log(`temp consumer: ${consumerRoot}`);

  runNpm(["install", "--ignore-scripts", "--no-audit", "--no-fund", tarballPath], consumerRoot);
  console.log("install: PASS");

  runCommand(process.execPath, [
    "--input-type=module",
    "--eval",
    "import { pickfix } from '@pickfix/vite-plugin'; if (typeof pickfix !== 'function') throw new Error('pickfix export missing');",
  ], consumerRoot);
  console.log("import: PASS");

  runNpm(["run", "build"], consumerRoot);
  console.log("build: PASS");
} finally {
  await rm(tempRoot, { force: true, recursive: true });
  console.log(`cleanup: removed ${tempRoot}`);
}

function runNpm(args, cwd) {
  const npmCli = process.env.npm_execpath;
  if (npmCli !== undefined && npmCli.length > 0) {
    return runCommand(process.execPath, [npmCli, ...args], cwd);
  }

  return runCommand(npmBinary(), args, cwd);
}

function runCommand(command, args, cwd) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (result.stdout.length > 0) {
    process.stdout.write(result.stdout);
  }
  if (result.stderr.length > 0) {
    process.stderr.write(result.stderr);
  }
  if (result.status !== 0) {
    throw new Error(`Command failed: ${command} ${args.join(" ")}`);
  }
  return result.stdout;
}

function npmBinary() {
  return process.platform === "win32" ? "npm.cmd" : "npm";
}

async function createTempRoot() {
  return mkdtemp(join(tmpdir(), "pickfix-pack-smoke-"));
}

function excludedCopyPath(path) {
  return (
    path === "node_modules" ||
    path.startsWith("node_modules/") ||
    path === "dist" ||
    path.startsWith("dist/") ||
    path.startsWith(".env")
  );
}

import { basename, dirname, extname, join, resolve, sep } from "node:path";

import type { ComponentContext, ImportSummary, PackageScript, StyleExcerpt } from "@pickfix/shared";
import { redactSensitiveText } from "@pickfix/shared";
import ts from "typescript";

import {
  emptyLimitedText,
  isRecord,
  limitDomSnapshot,
  limitText,
  parseJsonObject,
  projectRelativePath,
  readProjectText,
  type LimitedText,
} from "./context-bundler-helpers.js";
import { selectedComponentExcerpt } from "./component-excerpt.js";

const maxExcerptBytes = 40 * 1024;
const maxExcerptLines = 400;
const maxDomBytes = 10 * 1024;
const styleExtensions = [".css", ".scss", ".sass", ".less"] as const;
const verificationScriptNames = ["test", "typecheck", "build"] as const;

export type ContextBundleInput = {
  readonly baseContext: ComponentContext;
  readonly domSnapshot?: string;
  readonly homeDirectory?: string;
  readonly root: string;
};

type PackageInfo = {
  readonly name?: string;
  readonly scripts: PackageScript[];
};

type StyleExcerptInput = {
  readonly homeDirectory: string | undefined;
  readonly imports: readonly ImportSummary[];
  readonly root: string;
  readonly sourceFile: string;
  readonly sourceText: string | undefined;
};

export async function bundleComponentContext(input: ContextBundleInput): Promise<ComponentContext> {
  const redactionOptions = input.homeDirectory === undefined ? {} : { homeDirectory: input.homeDirectory };
  const sourceText = await readProjectText(input.root, input.baseContext.source.file);
  const sourceExcerpt =
    sourceText === undefined
      ? emptyLimitedText()
      : selectedComponentExcerpt(sourceText, {
          column: input.baseContext.source.column,
          componentName: input.baseContext.source.componentName,
          line: input.baseContext.source.line,
          limits: { bytes: maxExcerptBytes, lines: maxExcerptLines },
        });
  const imports = sourceText === undefined ? [] : collectImports(sourceText);
  const styles = await collectStyleExcerpts({
    homeDirectory: input.homeDirectory,
    imports,
    root: input.root,
    sourceFile: input.baseContext.source.file,
    sourceText,
  });
  const packageInfo = await readPackageInfo(input.root, input.homeDirectory);
  const sourceExcerptText = redactSensitiveText(sourceExcerpt.text, redactionOptions);
  const domSnapshot = limitDomSnapshot(input.domSnapshot ?? "", maxDomBytes);
  const domSnapshotText = redactSensitiveText(domSnapshot.text, redactionOptions);
  const verificationCommands = createVerificationCommands(packageInfo);

  return {
    ...input.baseContext,
    domSnapshot: domSnapshotText,
    excerpt: sourceExcerptText,
    imports,
    limits: {
      domBytes: Buffer.byteLength(domSnapshotText, "utf8"),
      domNodes: domSnapshot.lines,
      excerptBytes: Buffer.byteLength(sourceExcerptText, "utf8"),
      excerptLines: countLines(sourceExcerptText),
    },
    packageScripts: packageInfo.scripts,
    styles,
    verificationCommands,
  };
}

function collectImports(sourceText: string): ImportSummary[] {
  const sourceFile = ts.createSourceFile("component.tsx", sourceText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const imports: ImportSummary[] = [];

  for (const statement of sourceFile.statements) {
    if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)) {
      continue;
    }

    imports.push({
      imported: importNames(statement.importClause),
      specifier: statement.moduleSpecifier.text,
    });
  }

  return imports;
}

function importNames(clause: ts.ImportClause | undefined): string[] {
  const names: string[] = [];
  if (clause?.name !== undefined) {
    names.push(clause.name.text);
  }

  const bindings = clause?.namedBindings;
  if (bindings !== undefined) {
    if (ts.isNamespaceImport(bindings)) {
      names.push(`* as ${bindings.name.text}`);
    } else {
      for (const element of bindings.elements) {
        names.push(element.name.text);
      }
    }
  }

  return names.length === 0 ? ["side effect"] : names;
}

async function collectStyleExcerpts(input: StyleExcerptInput): Promise<StyleExcerpt[]> {
  const styleFiles = new Set<string>();
  const redactionOptions = input.homeDirectory === undefined ? {} : { homeDirectory: input.homeDirectory };

  for (const item of input.imports) {
    if (isStyleSpecifier(item.specifier)) {
      const importedFile = resolveImportPath(input.root, input.sourceFile, item.specifier);
      if (importedFile !== undefined) {
        styleFiles.add(importedFile);
      }
    }
  }

  for (const sameBaseFile of sameBasenameStyleFiles(input.sourceFile)) {
    styleFiles.add(sameBaseFile);
  }

  for (const entryStyle of await entryStyleFiles(input.root)) {
    styleFiles.add(entryStyle);
  }

  for (const tailwindConfig of ["tailwind.config.js", "tailwind.config.cjs", "tailwind.config.mjs", "tailwind.config.ts"]) {
    styleFiles.add(tailwindConfig);
  }

  const styles: StyleExcerpt[] = [];
  for (const file of styleFiles) {
    const text = await readProjectText(input.root, file);
    if (text !== undefined) {
      const excerpt = excerptStyleText(text, input.sourceText ?? "");
      styles.push({ excerpt: redactSensitiveText(excerpt.text, redactionOptions), file });
    }
  }

  return styles;
}

function isStyleSpecifier(specifier: string): boolean {
  return styleExtensions.some((extension) => specifier.endsWith(extension));
}

function sameBasenameStyleFiles(sourceFile: string): string[] {
  const directory = dirname(sourceFile);
  const extension = extname(sourceFile);
  const stem = basename(sourceFile, extension);
  return styleExtensions.map((styleExtension) => join(directory, `${stem}${styleExtension}`).split(sep).join("/"));
}

async function entryStyleFiles(root: string): Promise<string[]> {
  const entryCandidates = ["src/main.tsx", "src/main.jsx", "src/index.tsx", "src/index.jsx"];
  const styleFiles = new Set<string>();

  for (const entry of entryCandidates) {
    const text = await readProjectText(root, entry);
    if (text === undefined) {
      continue;
    }

    for (const item of collectImports(text)) {
      if (isStyleSpecifier(item.specifier)) {
        const styleFile = resolveImportPath(root, entry, item.specifier);
        if (styleFile !== undefined) {
          styleFiles.add(styleFile);
        }
      }
    }
  }

  return [...styleFiles];
}

function resolveImportPath(root: string, sourceFile: string, specifier: string): string | undefined {
  if (!specifier.startsWith(".")) {
    return undefined;
  }

  const resolved = projectRelativePath(root, resolve(root, dirname(sourceFile), specifier));
  return resolved;
}

async function readPackageInfo(root: string, homeDirectory: string | undefined): Promise<PackageInfo> {
  const text = await readProjectText(root, "package.json");
  if (text === undefined) {
    return { scripts: [] };
  }

  const parsed = parseJsonObject(text);
  if (parsed === undefined) {
    return { scripts: [] };
  }

  const nameValue = parsed["name"];
  const scriptsValue = parsed["scripts"];
  const scripts: PackageScript[] = [];
  if (isRecord(scriptsValue)) {
    const redactionOptions = homeDirectory === undefined ? {} : { homeDirectory };
    for (const [name, command] of Object.entries(scriptsValue)) {
      if (typeof command === "string") {
        scripts.push({ command: redactSensitiveText(command, redactionOptions), name });
      }
    }
  }

  return typeof nameValue === "string" ? { name: nameValue, scripts } : { scripts };
}

function createVerificationCommands(packageInfo: PackageInfo): string[] {
  const scriptNames = new Set(packageInfo.scripts.map((script) => script.name));
  const workspaceSuffix = packageInfo.name === undefined ? "" : ` --workspace ${packageInfo.name}`;
  return verificationScriptNames
    .filter((name) => scriptNames.has(name))
    .map((name) => `npm run ${name}${workspaceSuffix}`);
}

function excerptStyleText(text: string, sourceText: string): LimitedText {
  const classNames = collectClassNames(sourceText);
  if (classNames.length === 0) {
    return limitText(text, maxExcerptBytes, 40);
  }

  const lines = text.split(/\r?\n/);
  const matchedLine = lines.findIndex((line) => classNames.some((className) => line.includes(`.${className}`)));
  if (matchedLine < 0) {
    return limitText(text, maxExcerptBytes, 40);
  }

  const start = Math.max(0, matchedLine - 20);
  return limitText(lines.slice(start, start + 40).join("\n"), maxExcerptBytes, 40);
}

function collectClassNames(sourceText: string): string[] {
  const names = new Set<string>();
  for (const match of sourceText.matchAll(/className=["']([^"']+)["']/g)) {
    const rawNames = match[1];
    if (rawNames !== undefined) {
      for (const name of rawNames.split(/\s+/)) {
        if (name.length > 0) {
          names.add(name);
        }
      }
    }
  }

  return [...names];
}

function countLines(text: string): number {
  return text.length === 0 ? 0 : text.split(/\r?\n/).length;
}

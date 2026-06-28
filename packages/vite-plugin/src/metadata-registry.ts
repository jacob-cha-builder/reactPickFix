import { relative, sep } from "node:path";

import type { ComponentContext, ResolverConfidence, SelectionTarget } from "@pickfix/shared";

export type SourceLocation = {
  readonly file: string;
  readonly line: number;
  readonly column: number;
  readonly componentName: string;
};

export type SourceMetadataEntry = SourceLocation & {
  readonly id: string;
};

export type SourceMetadataRegistry = {
  readonly root: string;
  readonly register: (entry: SourceMetadataEntry) => string;
  readonly resolveById: (id: string) => ComponentContext | undefined;
  readonly invalidateFile: (file: string) => void;
};

type RegistryState = {
  readonly root: string;
  readonly entriesById: Map<string, SourceLocation>;
  readonly idsByFile: Map<string, Set<string>>;
};

export function createSourceMetadataRegistry(options: { readonly root: string }): SourceMetadataRegistry {
  const state: RegistryState = {
    entriesById: new Map(),
    idsByFile: new Map(),
    root: normalizePath(options.root),
  };

  return {
    root: state.root,
    register(entry: SourceMetadataEntry): string {
      const normalizedFile = normalizeProjectFile(state.root, entry.file);
      const registeredId = reserveId(state.entriesById, entry.id);
      state.entriesById.set(registeredId, {
        column: entry.column,
        componentName: entry.componentName,
        file: normalizedFile,
        line: entry.line,
      });

      const existingIds = state.idsByFile.get(normalizedFile);
      if (existingIds === undefined) {
        state.idsByFile.set(normalizedFile, new Set([registeredId]));
      } else {
        existingIds.add(registeredId);
      }

      return registeredId;
    },
    resolveById(id: string): ComponentContext | undefined {
      const entry = state.entriesById.get(id);
      if (entry === undefined) {
        return undefined;
      }

      return createContext(id, entry, "high", []);
    },
    invalidateFile(file: string): void {
      const normalizedFile = normalizeProjectFile(state.root, file);
      const ids = state.idsByFile.get(normalizedFile);
      if (ids === undefined) {
        return;
      }

      for (const id of ids) {
        state.entriesById.delete(id);
      }
      state.idsByFile.delete(normalizedFile);
    },
  };
}

export function createContext(
  selectionId: string,
  source: SourceLocation,
  confidence: ResolverConfidence,
  ownerChain: readonly string[],
): ComponentContext {
  return {
    confidence,
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
    ownerChain: [...ownerChain],
    packageScripts: [],
    selectionId,
    source: createSelectionTarget(selectionId, source),
    styles: [],
    verificationCommands: [],
  };
}

function createSelectionTarget(id: string, source: SourceLocation): SelectionTarget {
  return {
    column: source.column,
    componentName: source.componentName,
    file: source.file,
    id,
    line: source.line,
  };
}

function reserveId(entriesById: ReadonlyMap<string, SourceLocation>, baseId: string): string {
  if (!entriesById.has(baseId)) {
    return baseId;
  }

  for (let ordinal = 2; ordinal < 10_000; ordinal += 1) {
    const candidate = `${baseId}-${ordinal}`;
    if (!entriesById.has(candidate)) {
      return candidate;
    }
  }

  throw new Error(`Could not allocate unique pickfix id for ${baseId}`);
}

function normalizeProjectFile(root: string, file: string): string {
  const normalizedFile = normalizePath(file);
  if (normalizedFile === root || normalizedFile.startsWith(`${root}/`)) {
    return normalizePath(relative(root, normalizedFile));
  }

  return normalizedFile;
}

function normalizePath(file: string): string {
  return file.split(sep).join("/");
}

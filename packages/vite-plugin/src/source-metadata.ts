import { createHash } from "node:crypto";
import { relative, sep } from "node:path";

import ts from "typescript";

import type { SourceMetadataRegistry } from "./metadata-registry.js";
import {
  collectComponentDisplayNames,
  isWrapperRenderFunction,
  wrappedComponentName,
} from "./react-wrapper-labels.js";

export type SourceMetadataTransformOptions = {
  readonly code: string;
  readonly id: string;
  readonly registry: SourceMetadataRegistry;
  readonly root: string;
};

export type SourceMetadataTransformResult = {
  readonly code: string;
  readonly map: null;
};

type ComponentFrame = {
  readonly name: string;
};

const generatedDirectories = new Set(["build", "dist"]);

export function transformSourceMetadata(options: SourceMetadataTransformOptions): SourceMetadataTransformResult | null {
  const cleanId = stripQuery(options.id);
  if (!shouldTransformFile(cleanId, options.root)) {
    return null;
  }

  const sourceFile = ts.createSourceFile(cleanId, options.code, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const relativeFile = normalizeRelativeFile(options.root, cleanId);
  const displayNames = collectComponentDisplayNames(sourceFile);
  const componentStack: ComponentFrame[] = [];
  let jsxOrdinal = 0;

  const transformer: ts.TransformerFactory<ts.SourceFile> = (context) => {
    const visit: ts.Visitor = (node) => {
      const componentName = getComponentName(node, sourceFile, displayNames);
      if (componentName !== undefined) {
        componentStack.push({ name: componentName });
        const visited = ts.visitEachChild(node, visit, context);
        componentStack.pop();
        return visited;
      }

      if (ts.isJsxOpeningElement(node)) {
        return annotateOpeningElement(node, sourceFile, relativeFile, componentStack, options.registry, jsxOrdinal++);
      }

      if (ts.isJsxSelfClosingElement(node)) {
        return annotateSelfClosingElement(node, sourceFile, relativeFile, componentStack, options.registry, jsxOrdinal++);
      }

      return ts.visitEachChild(node, visit, context);
    };

    return (node) => {
      const visited = ts.visitNode(node, visit, ts.isSourceFile);
      return visited ?? node;
    };
  };

  const result = ts.transform(sourceFile, [transformer]);
  const transformedSource = result.transformed[0];
  result.dispose();

  if (transformedSource === undefined) {
    return null;
  }

  return {
    code: ts.createPrinter().printFile(transformedSource),
    map: null,
  };
}

function annotateOpeningElement(
  node: ts.JsxOpeningElement,
  sourceFile: ts.SourceFile,
  relativeFile: string,
  componentStack: readonly ComponentFrame[],
  registry: SourceMetadataRegistry,
  ordinal: number,
): ts.JsxOpeningElement {
  if (!shouldAnnotateTag(node.tagName)) {
    return node;
  }

  const id = registerElement(node, sourceFile, relativeFile, componentStack, registry, ordinal);
  return ts.factory.updateJsxOpeningElement(
    node,
    node.tagName,
    node.typeArguments,
    appendPickfixAttribute(node.attributes, id),
  );
}

function annotateSelfClosingElement(
  node: ts.JsxSelfClosingElement,
  sourceFile: ts.SourceFile,
  relativeFile: string,
  componentStack: readonly ComponentFrame[],
  registry: SourceMetadataRegistry,
  ordinal: number,
): ts.JsxSelfClosingElement {
  if (!shouldAnnotateTag(node.tagName)) {
    return node;
  }

  const id = registerElement(node, sourceFile, relativeFile, componentStack, registry, ordinal);
  return ts.factory.updateJsxSelfClosingElement(
    node,
    node.tagName,
    node.typeArguments,
    appendPickfixAttribute(node.attributes, id),
  );
}

function appendPickfixAttribute(attributes: ts.JsxAttributes, id: string): ts.JsxAttributes {
  return ts.factory.updateJsxAttributes(attributes, [
    ...attributes.properties,
    ts.factory.createJsxAttribute(ts.factory.createIdentifier("data-pickfix-id"), ts.factory.createStringLiteral(id)),
  ]);
}

function registerElement(
  node: ts.Node,
  sourceFile: ts.SourceFile,
  relativeFile: string,
  componentStack: readonly ComponentFrame[],
  registry: SourceMetadataRegistry,
  ordinal: number,
): string {
  const position = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
  const line = position.line + 1;
  const column = position.character;
  const componentName = componentStack.at(-1)?.name ?? anonymousComponentName(relativeFile, line, column);
  const baseId = createStableId(relativeFile, line, column, ordinal);

  return registry.register({
    column,
    componentName,
    file: relativeFile,
    id: baseId,
    line,
  });
}

function shouldAnnotateTag(tagName: ts.JsxTagNameExpression): boolean {
  if (!ts.isIdentifier(tagName)) {
    return false;
  }

  const firstCharacter = tagName.text[0];
  return firstCharacter !== undefined && firstCharacter.toLowerCase() === firstCharacter;
}

function getComponentName(
  node: ts.Node,
  sourceFile: ts.SourceFile,
  displayNames: ReadonlyMap<string, string>,
): string | undefined {
  if (ts.isFunctionDeclaration(node) && node.name !== undefined && isComponentName(node.name.text)) {
    return node.name.text;
  }

  if (ts.isClassDeclaration(node) && node.name !== undefined && isComponentName(node.name.text)) {
    return node.name.text;
  }

  if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && isComponentName(node.name.text)) {
    if (node.initializer !== undefined && (ts.isArrowFunction(node.initializer) || ts.isFunctionExpression(node.initializer))) {
      return node.name.text;
    }
    if (node.initializer !== undefined) {
      return wrappedComponentName(node.name.text, node.initializer, displayNames);
    }
  }

  if (ts.isFunctionExpression(node) && node.name !== undefined && isComponentName(node.name.text)) {
    if (isWrapperRenderFunction(node)) {
      return undefined;
    }
    return node.name.text;
  }

  if (ts.isArrowFunction(node)) {
    const parent = node.parent;
    if (ts.isVariableDeclaration(parent) && ts.isIdentifier(parent.name) && isComponentName(parent.name.text)) {
      return parent.name.text;
    }
  }

  if (ts.isSourceFile(node)) {
    return anonymousComponentName(normalizeRelativeFile("", sourceFile.fileName), 1, 0);
  }

  return undefined;
}

function isComponentName(name: string): boolean {
  const firstCharacter = name[0];
  return firstCharacter !== undefined && firstCharacter.toUpperCase() === firstCharacter;
}

function createStableId(relativeFile: string, line: number, column: number, ordinal: number): string {
  return createHash("sha1").update(`${relativeFile}:${line}:${column}:${ordinal}`).digest("base64url").toLowerCase().slice(0, 12);
}

function shouldTransformFile(file: string, root: string): boolean {
  if (file.includes("\0") || file.startsWith("virtual:")) {
    return false;
  }
  if (!file.endsWith(".tsx") && !file.endsWith(".jsx")) {
    return false;
  }

  const relativeFile = normalizeRelativeFile(root, file);
  if (relativeFile.startsWith("../") || relativeFile === "..") {
    return false;
  }

  const segments = relativeFile.split("/");
  return !segments.some((segment) => segment === "node_modules" || generatedDirectories.has(segment));
}

function normalizeRelativeFile(root: string, file: string): string {
  const relativeFile = root.length === 0 ? file : relative(root, file);
  return relativeFile.split(sep).join("/");
}

function anonymousComponentName(relativeFile: string, line: number, column: number): string {
  const fileName = relativeFile.split("/").at(-1) ?? "Component";
  return `${fileName}:${line}:${column}`;
}

function stripQuery(id: string): string {
  return id.split("?")[0] ?? id;
}

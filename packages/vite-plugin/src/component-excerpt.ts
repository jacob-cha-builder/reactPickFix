import ts from "typescript";

import { limitText, type LimitedText } from "./context-bundler-helpers.js";

export type SelectedComponentExcerptTarget = {
  readonly column: number;
  readonly componentName: string;
  readonly line: number;
  readonly limits: ExcerptLimits;
};

type ExcerptLimits = {
  readonly bytes: number;
  readonly lines: number;
};

type ComponentNodeMatch = {
  readonly nameMatches: boolean;
  readonly node: ts.Node;
};

export function selectedComponentExcerpt(text: string, target: SelectedComponentExcerptTarget): LimitedText {
  const sourceFile = ts.createSourceFile("component.tsx", text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const componentNode = findSelectedComponentNode(sourceFile, target);
  if (componentNode === undefined) {
    return excerptAroundLine(text, target);
  }

  return excerptForNode(text, sourceFile, componentNode, target.limits);
}

function findSelectedComponentNode(
  sourceFile: ts.SourceFile,
  target: SelectedComponentExcerptTarget,
): ts.Node | undefined {
  const selectedPosition = selectedPositionForTarget(sourceFile, target);
  const matches: ComponentNodeMatch[] = [];

  function visit(node: ts.Node): void {
    const candidate = componentCandidate(node);
    if (candidate !== undefined && containsPosition(candidate.node, selectedPosition)) {
      matches.push({
        nameMatches: candidate.name === target.componentName,
        node: candidate.node,
      });
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);

  const namedMatches = matches.filter((match) => match.nameMatches);
  const candidates = namedMatches.length > 0 ? namedMatches : matches;
  return candidates.sort((left, right) => nodeSpan(left.node) - nodeSpan(right.node))[0]?.node;
}

function selectedPositionForTarget(sourceFile: ts.SourceFile, target: SelectedComponentExcerptTarget): number {
  const lineCount = sourceFile.getLineStarts().length;
  const lineIndex = Math.min(Math.max(target.line - 1, 0), Math.max(lineCount - 1, 0));
  const columnIndex = Math.max(target.column - 1, 0);
  return sourceFile.getPositionOfLineAndCharacter(lineIndex, columnIndex);
}

function componentCandidate(node: ts.Node): { readonly name: string; readonly node: ts.Node } | undefined {
  if ((ts.isFunctionDeclaration(node) || ts.isClassDeclaration(node)) && node.name !== undefined) {
    return { name: node.name.text, node };
  }

  if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer !== undefined) {
    return { name: node.name.text, node: variableDeclarationRangeNode(node) };
  }

  return undefined;
}

function variableDeclarationRangeNode(node: ts.VariableDeclaration): ts.Node {
  const declarationList = node.parent;
  const statement = declarationList.parent;
  return ts.isVariableStatement(statement) ? statement : node;
}

function containsPosition(node: ts.Node, position: number): boolean {
  return node.getStart() <= position && position <= node.getEnd();
}

function nodeSpan(node: ts.Node): number {
  return node.getEnd() - node.getStart();
}

function excerptForNode(text: string, sourceFile: ts.SourceFile, node: ts.Node, limits: ExcerptLimits): LimitedText {
  const start = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line;
  const end = sourceFile.getLineAndCharacterOfPosition(node.getEnd()).line;
  return limitText(text.split(/\r?\n/).slice(start, end + 1).join("\n"), limits.bytes, limits.lines);
}

function excerptAroundLine(text: string, target: SelectedComponentExcerptTarget): LimitedText {
  const lines = text.split(/\r?\n/);
  const selectedIndex = Math.max(0, target.line - 1);
  const start = Math.max(0, selectedIndex - Math.floor(target.limits.lines / 2));
  const end = Math.min(lines.length, start + target.limits.lines);
  return limitText(lines.slice(start, end).join("\n"), target.limits.bytes, target.limits.lines);
}

import ts from "typescript";

const wrapperCallNames = new Set(["forwardRef", "memo"]);

export function collectComponentDisplayNames(sourceFile: ts.SourceFile): ReadonlyMap<string, string> {
  const displayNames = new Map<string, string>();

  for (const statement of sourceFile.statements) {
    if (!ts.isExpressionStatement(statement) || !ts.isBinaryExpression(statement.expression)) {
      continue;
    }

    const assignment = statement.expression;
    if (assignment.operatorToken.kind !== ts.SyntaxKind.EqualsToken || !ts.isStringLiteral(assignment.right)) {
      continue;
    }

    const left = assignment.left;
    if (
      ts.isPropertyAccessExpression(left) &&
      left.name.text === "displayName" &&
      ts.isIdentifier(left.expression) &&
      isComponentName(left.expression.text)
    ) {
      displayNames.set(left.expression.text, assignment.right.text);
    }
  }

  return displayNames;
}

export function wrappedComponentName(
  wrapperName: string,
  initializer: ts.Expression,
  displayNames: ReadonlyMap<string, string>,
): string | undefined {
  if (!ts.isCallExpression(initializer) || !isWrapperCallExpression(initializer.expression)) {
    return undefined;
  }

  const displayName = displayNames.get(wrapperName);
  if (displayName !== undefined) {
    return displayName;
  }

  const renderTarget = initializer.arguments[0];
  if (renderTarget === undefined) {
    return wrapperName;
  }

  return wrappedRenderName(renderTarget, displayNames) ?? wrapperName;
}

export function isWrapperRenderFunction(node: ts.FunctionExpression): boolean {
  const parent = node.parent;
  return ts.isCallExpression(parent) && isWrapperCallExpression(parent.expression);
}

function wrappedRenderName(node: ts.Node, displayNames: ReadonlyMap<string, string>): string | undefined {
  if (ts.isFunctionExpression(node) && node.name !== undefined && isComponentName(node.name.text)) {
    return node.name.text;
  }

  if (ts.isIdentifier(node) && isComponentName(node.text)) {
    return displayNames.get(node.text) ?? node.text;
  }

  if (ts.isCallExpression(node) && isWrapperCallExpression(node.expression)) {
    const renderTarget = node.arguments[0];
    return renderTarget === undefined ? undefined : wrappedRenderName(renderTarget, displayNames);
  }

  return undefined;
}

function isWrapperCallExpression(expression: ts.Expression): boolean {
  if (ts.isIdentifier(expression)) {
    return wrapperCallNames.has(expression.text);
  }

  return ts.isPropertyAccessExpression(expression) && wrapperCallNames.has(expression.name.text);
}

function isComponentName(name: string): boolean {
  const firstCharacter = name[0];
  return firstCharacter !== undefined && firstCharacter.toUpperCase() === firstCharacter;
}

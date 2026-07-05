import type { ComponentContext, HandoffMode, PromptBundle, PromptIntent } from "./schemas.js";
import { redactSensitiveText } from "./schemas.js";

const maxSourceSnippetLines = 18;
const maxSourceSnippetCharacters = 900;

export type PromptBundleBuildInput = {
  readonly context: ComponentContext;
  readonly homeDirectory?: string;
  readonly intent: PromptIntent;
  readonly verificationCommands?: readonly string[];
};

export function buildPromptBundle(input: PromptBundleBuildInput): PromptBundle {
  const redactionOptions = input.homeDirectory === undefined ? {} : { homeDirectory: input.homeDirectory };
  const prompt = redactSensitiveText(
    [
      targetHeader(input.intent.target),
      "",
      `Component: ${oneLineData(input.context.source.componentName)}`,
      `File: ${oneLineData(input.context.source.file)}:${input.context.source.line}:${input.context.source.column}`,
      `Confidence: ${input.context.confidence}`,
      "",
      "Change",
      ...requestedChangeLines(input.intent.change),
      "",
      "Source excerpt",
      indentedBlock(limitSnippet(input.context.excerpt, maxSourceSnippetLines, maxSourceSnippetCharacters)),
    ].join("\n"),
    redactionOptions,
  );

  const baseBundle = {
    ok: true,
    prompt,
    summary: `${oneLineData(input.context.source.componentName)} in ${oneLineData(input.context.source.file)}`,
    target: input.intent.target,
    warnings: [...warningList(input.context)],
  } satisfies Omit<PromptBundle, "command">;

  if (input.intent.target === "codex") {
    return {
      ...baseBundle,
      command: codexCommand(),
    };
  }

  return baseBundle;
}

function targetHeader(target: HandoffMode): string {
  switch (target) {
    case "generic":
      return "Apply this selected React component change.";
    case "claude":
      return "Claude: apply this selected React component change.";
    case "codex":
      return "Codex: apply this selected React component change.";
    default:
      return assertNever(target);
  }
}

function assertNever(value: never): never {
  throw new Error(`Unhandled prompt target: ${value}`);
}

function formatField(value: string | undefined): string {
  if (value === undefined || value.trim().length === 0) {
    return "Not requested";
  }

  const normalized = normalizeLines(value).trimEnd();
  if (!normalized.includes("\n")) {
    return oneLineData(normalized);
  }

  return `\n${indentedBlock(normalized)}`;
}

function requestedChangeLines(change: PromptIntent["change"]): readonly string[] {
  return [
    ...commentLines(change),
    ...textEditLines(change),
    ...optionalRequestLine("Font size", change.size),
    ...optionalRequestLine("Position", change.position),
  ];
}

function commentLines(change: PromptIntent["change"]): readonly string[] {
  const comments = change.comments?.filter((comment) => comment.trim().length > 0) ?? [];
  if (comments.length > 0) {
    return ["Comments", ...comments.map((comment, index) => `${index + 1}. ${formatField(comment)}`)];
  }

  return [`Comment: ${formatField(change.text ?? change.notes)}`];
}

function textEditLines(change: PromptIntent["change"]): readonly string[] {
  if (change.textEdit === undefined) {
    return [];
  }

  return [
    `Text edit: Replace ${quotedOneLineData(change.textEdit.from)} with ${quotedOneLineData(
      change.textEdit.to,
    )} in ${quotedOneLineData(change.textEdit.target)}`,
  ];
}

function optionalRequestLine(label: string, value: string | undefined): readonly string[] {
  return value === undefined || value.trim().length === 0 ? [] : [`${label}: ${formatField(value)}`];
}

function indentedBlock(value: string): string {
  return normalizeLines(value)
    .split("\n")
    .map((line) => `    ${line}`)
    .join("\n");
}

function limitSnippet(value: string, maxLines: number, maxCharacters: number): string {
  const lineLimited = normalizeLines(value).split("\n").slice(0, maxLines).join("\n");
  if (lineLimited.length <= maxCharacters) {
    return lineLimited;
  }

  return `${lineLimited.slice(0, maxCharacters).trimEnd()}\n...`;
}

function normalizeLines(value: string): string {
  return value.replace(/\r\n?/g, "\n");
}

function oneLineData(value: string): string {
  return normalizeLines(value).replace(/\n+/g, " ").trim();
}

function quotedOneLineData(value: string): string {
  return JSON.stringify(oneLineData(value));
}

function codexCommand(): string {
  return 'pbpaste | codex exec "Apply this selected React component change."';
}

function warningList(context: ComponentContext): readonly string[] {
  return context.confidence === "high" ? [] : [`Resolver confidence is ${context.confidence}; verify the source target before editing.`];
}

import { z } from "zod";

const selectionIdPattern = /^[a-z0-9_-]{8,96}$/i;
const windowsAbsolutePathPattern = /^[A-Za-z]:[\\/]/;
const maxPromptBytes = 256 * 1024;
const maxExcerptBytes = 40 * 1024;
const maxDomBytes = 10 * 1024;
const maxTextEditFieldCharacters = 1_000;

const secretValuePattern =
  /\b([A-Z0-9_]*(?:TOKEN|SECRET|PASSWORD|API_KEY|PRIVATE_KEY|ACCESS_KEY_ID|ACCESS_KEY))\b\s*[:=]\s*[^\r\n]+/gi;
const authorizationPattern = /\bAuthorization\s*:\s*[^\r\n]+/gi;
const bearerPattern = /\bBearer\s+[A-Za-z0-9._~+/=-]+/gi;
const openAiKeyPattern = /\bsk-[A-Za-z0-9_-]{8,}\b/g;
const slackTokenPattern = /\bxox[A-Za-z0-9-]{8,}\b/g;
const githubTokenPattern = /\bghp_[A-Za-z0-9_]{8,}\b/g;
const awsAccessKeyPattern = /\bAKIA[A-Z0-9]{12,}\b/g;
const processEnvPattern = /\bprocess\.env\b/g;
const envFileReferencePattern = /(^|[\s"'`(=:/\\])\.env[a-z0-9._-]*/gi;
const formValueAttributePattern = /\s(?:checked|selected|value)\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi;
const credentialAttributePattern =
  /\s(?:aria-[\w:-]+|autocomplete|class|data-[\w:-]+|id|name|type)\s*=\s*(?:"[^"]*(?:password|passcode|current-password|new-password|one-time-code|otp|token|secret|credential)[^"]*"|'[^']*(?:password|passcode|current-password|new-password|one-time-code|otp|token|secret|credential)[^']*'|[^\s>]*(?:password|passcode|current-password|new-password|one-time-code|otp|token|secret|credential)[^\s>]*)/gi;

export const ResolverConfidenceSchema = z.enum(["high", "medium", "low"]);
export type ResolverConfidence = z.infer<typeof ResolverConfidenceSchema>;

export const HandoffModeSchema = z.enum(["generic", "claude", "codex"]);
export type HandoffMode = z.infer<typeof HandoffModeSchema>;

export type ReadablePathDecision =
  | { readonly readable: true }
  | { readonly readable: false; readonly reason: "absolute-path" | "empty-path" | "env-file" | "node-modules" | "path-traversal" };

export function excludeReadablePath(filePath: string): ReadablePathDecision {
  const normalizedPath = filePath.replaceAll("\\", "/");
  if (normalizedPath.length === 0) {
    return { readable: false, reason: "empty-path" };
  }
  if (normalizedPath.startsWith("/") || windowsAbsolutePathPattern.test(filePath)) {
    return { readable: false, reason: "absolute-path" };
  }

  const pathSegments = normalizedPath.split("/");
  for (const segment of pathSegments) {
    if (segment === "" || segment === "." || segment === "..") {
      return { readable: false, reason: "path-traversal" };
    }
    if (segment.startsWith(".env")) {
      return { readable: false, reason: "env-file" };
    }
    if (segment === "node_modules") {
      return { readable: false, reason: "node-modules" };
    }
  }

  return { readable: true };
}

const safeRelativePathSchema = z.string().min(1).superRefine((filePath, context) => {
  const decision = excludeReadablePath(filePath);
  if (!decision.readable) {
    context.addIssue({
      code: "custom",
      message: `Unsafe project-relative path: ${decision.reason}`,
    });
  }
});

const boundedTextSchema = z.string().max(maxPromptBytes);
const boundedExcerptSchema = z.string().max(maxExcerptBytes);
const boundedDomSnapshotSchema = z.string().max(maxDomBytes);
const textEditFieldSchema = z
  .string()
  .min(1)
  .max(maxTextEditFieldCharacters)
  .refine((value) => value.trim().length > 0, { message: "Text edit field cannot be blank" });

export const SelectionTargetSchema = z
  .object({
    id: z.string().regex(selectionIdPattern),
    file: safeRelativePathSchema,
    line: z.number().int().positive(),
    column: z.number().int().nonnegative(),
    componentName: z.string().min(1).max(200),
  })
  .strict();
export type SelectionTarget = z.infer<typeof SelectionTargetSchema>;

export const ImportSummarySchema = z
  .object({
    specifier: z.string().min(1).max(500),
    imported: z.array(z.string().min(1).max(200)).max(100),
  })
  .strict();
export type ImportSummary = z.infer<typeof ImportSummarySchema>;

export const StyleExcerptSchema = z
  .object({
    file: safeRelativePathSchema,
    excerpt: boundedExcerptSchema,
  })
  .strict();
export type StyleExcerpt = z.infer<typeof StyleExcerptSchema>;

export const PackageScriptSchema = z
  .object({
    name: z.string().min(1).max(120),
    command: z.string().min(1).max(1_000),
  })
  .strict();
export type PackageScript = z.infer<typeof PackageScriptSchema>;

export const ContextLimitsSchema = z
  .object({
    excerptLines: z.number().int().nonnegative().max(400),
    excerptBytes: z.number().int().nonnegative().max(maxExcerptBytes),
    domNodes: z.number().int().nonnegative().max(20),
    domBytes: z.number().int().nonnegative().max(maxDomBytes),
  })
  .strict();
export type ContextLimits = z.infer<typeof ContextLimitsSchema>;

export const ComponentContextSchema = z
  .object({
    ok: z.literal(true),
    selectionId: z.string().regex(selectionIdPattern),
    confidence: ResolverConfidenceSchema,
    source: SelectionTargetSchema,
    ownerChain: z.array(z.string().min(1).max(200)).max(50),
    excerpt: boundedExcerptSchema,
    imports: z.array(ImportSummarySchema).max(200),
    styles: z.array(StyleExcerptSchema).max(100),
    packageScripts: z.array(PackageScriptSchema).max(100),
    verificationCommands: z.array(z.string().min(1).max(1_000)).max(20),
    domSnapshot: boundedDomSnapshotSchema,
    limits: ContextLimitsSchema,
  })
  .strict();
export type ComponentContext = z.infer<typeof ComponentContextSchema>;

export const PromptChangeSchema = z
  .object({
    comments: z.array(boundedTextSchema).max(20).optional(),
    text: boundedTextSchema.optional(),
    textEdit: z
      .object({
        from: textEditFieldSchema,
        target: textEditFieldSchema,
        to: textEditFieldSchema,
      })
      .strict()
      .optional(),
    notes: boundedTextSchema.optional(),
  })
  .strict();
export type PromptChange = z.infer<typeof PromptChangeSchema>;

export const PromptIntentSchema = z
  .object({
    selectionId: z.string().regex(selectionIdPattern),
    change: PromptChangeSchema,
    target: HandoffModeSchema,
  })
  .strict();
export type PromptIntent = z.infer<typeof PromptIntentSchema>;

export const PromptBundleSchema = z
  .object({
    ok: z.literal(true),
    target: HandoffModeSchema,
    prompt: boundedTextSchema,
    summary: z.string().min(1).max(1_000),
    command: z.string().min(1).max(4_000).optional(),
    warnings: z.array(z.string().min(1).max(1_000)).max(50),
  })
  .strict();
export type PromptBundle = z.infer<typeof PromptBundleSchema>;

export type RedactionOptions = {
  readonly homeDirectory?: string;
};

export function redactSensitiveText(text: string, options: RedactionOptions = {}): string {
  const homeRedacted = redactHomeDirectory(text, options.homeDirectory);

  return homeRedacted
    .replace(secretValuePattern, "[REDACTED]")
    .replace(authorizationPattern, "Authorization: [REDACTED]")
    .replace(bearerPattern, "[REDACTED]")
    .replace(openAiKeyPattern, "[REDACTED]")
    .replace(slackTokenPattern, "[REDACTED]")
    .replace(githubTokenPattern, "[REDACTED]")
    .replace(awsAccessKeyPattern, "[REDACTED]")
    .replace(processEnvPattern, "process.[REDACTED_ENV]")
    .replace(envFileReferencePattern, "$1[REDACTED_ENV_FILE]")
    .replace(formValueAttributePattern, "")
    .replace(credentialAttributePattern, "");
}

function redactHomeDirectory(text: string, homeDirectory: string | undefined): string {
  if (homeDirectory === undefined || homeDirectory.length === 0) {
    return text;
  }

  return text.replaceAll(homeDirectory, "[HOME]");
}

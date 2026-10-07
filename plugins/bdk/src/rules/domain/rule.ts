// The rule file (spec `rule-pack`, "Rule file"; design D2): YAML frontmatter and the rule text.
// The id is the file name and the language pack the `languages/<name>/` directory, so neither
// can disagree with the file's place.

import { parse, YAMLParseError } from "yaml";
import { z } from "zod";

export const STAGES = ["design", "plan", "execute", "review"] as const;
export type Stage = (typeof STAGES)[number];

export const KINDS = ["house", "knowledge"] as const;
export const ORIGINS = ["bdk", "project"] as const;

/** The prefix of the BDK pack's ids; a project rule may not use it (design D5). */
export const PACK_PREFIX = "BDK-";

const ID = /^[A-Za-z0-9][A-Za-z0-9-]*$/;
const text = z.string().min(1, "must not be empty");

const Frontmatter = z
  .strictObject({
    kind: z.enum(KINDS),
    paths: z.array(text).min(1, "must name at least one glob"),
    stages: z
      .array(z.enum(STAGES))
      .min(1, "must name at least one stage")
      .refine((stages) => new Set(stages).size === stages.length, "must not repeat a stage"),
    source: text.optional(),
    verified: z.iso.date("must be a date YYYY-MM-DD").optional(),
    measured: z.strictObject({ report: text, bullet: text, class: text }).optional(),
  })
  .superRefine((value, ctx) => {
    for (const key of ["source", "verified"] as const) {
      if (value.kind === "knowledge" && value[key] === undefined) {
        ctx.addIssue({ code: "custom", path: [key], message: "is required for a knowledge rule" });
      }
      if (value.kind === "house" && value[key] !== undefined) {
        ctx.addIssue({ code: "custom", path: [key], message: "belongs to knowledge rules only" });
      }
    }
  });

export interface Rule {
  readonly id: string;
  readonly origin: (typeof ORIGINS)[number];
  /** The language pack, from `languages/<name>/`; null for a rule of no language. */
  readonly language: string | null;
  /** Where the rule lives, for messages and output: `rules/...` or `.bdk/rules/...`. */
  readonly file: string;
  readonly kind: (typeof KINDS)[number];
  readonly paths: readonly string[];
  readonly stages: readonly Stage[];
  readonly source: string | null;
  readonly verified: string | null;
  readonly measured: {
    readonly report: string;
    readonly bullet: string;
    readonly class: string;
  } | null;
  readonly text: string;
}

export interface RuleSource {
  /** The path inside the rules directory, `/`-separated. */
  readonly relPath: string;
  readonly file: string;
  readonly origin: Rule["origin"];
  readonly content: string;
}

/** Whether a path inside a rules directory is a rule: a Markdown file other than README.md. */
export function isRuleFile(relPath: string): boolean {
  const name = relPath.slice(relPath.lastIndexOf("/") + 1);
  return name.endsWith(".md") && name !== "README.md";
}

/** The `---` frontmatter and the text after it, or undefined without a closed block. */
function split(content: string): { yaml: string; body: string } | undefined {
  const lines = content
    .replace(/^\uFEFF/, "")
    .replace(/\r\n/g, "\n")
    .split("\n");
  const fence = (line: string | undefined): boolean => line?.trimEnd() === "---";
  if (!fence(lines[0])) return undefined;
  const end = lines.findIndex((line, i) => i > 0 && fence(line));
  if (end === -1) return undefined;
  return { yaml: lines.slice(1, end).join("\n"), body: lines.slice(end + 1).join("\n") };
}

/** The rule, or a problem naming the field (the caller adds the file). */
export function parseRule(source: RuleSource): Rule | string {
  const segments = source.relPath.split("/");
  const id = (segments.at(-1) ?? "").replace(/\.md$/, "");
  if (!ID.test(id)) return `id ${JSON.stringify(id)} must be letters, digits and -`;
  if (source.origin === "project" && id.startsWith(PACK_PREFIX)) {
    return `id ${id} uses the prefix ${PACK_PREFIX} reserved for the BDK pack; rename the file`;
  }
  const parts = split(source.content);
  if (parts === undefined) return "no frontmatter: the file must start with a --- block";
  let data: unknown;
  try {
    data = parse(parts.yaml);
  } catch (error) {
    if (error instanceof YAMLParseError) return `frontmatter is not valid YAML: ${error.message}`;
    throw error;
  }
  if (typeof data !== "object" || data === null || Array.isArray(data)) {
    return "frontmatter must be a mapping";
  }
  const result = Frontmatter.safeParse(data);
  if (!result.success) {
    return result.error.issues
      .map((issue) => `${issue.path.join(".") || "frontmatter"}: ${issue.message}`)
      .join("; ");
  }
  const body = parts.body.trim();
  if (body === "") return "the rule text after the frontmatter is empty";
  const front = result.data;
  return {
    id,
    origin: source.origin,
    language: segments[0] === "languages" && segments.length >= 3 ? (segments[1] ?? null) : null,
    file: source.file,
    kind: front.kind,
    paths: front.paths,
    stages: front.stages,
    source: front.source ?? null,
    verified: front.verified ?? null,
    measured: front.measured ?? null,
    text: body,
  };
}

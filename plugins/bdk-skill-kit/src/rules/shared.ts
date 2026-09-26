// Helpers that several rules share: how a document is named, how a tool list
// field reads, what a `!` block is, and option checks.
import { basename } from "node:path";
import type { Document } from "../index.ts";

/** A skill, agent or plugin name: lowercase letters, digits and single hyphens. */
export const NAME = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/** The name a document runs under: `name`, else the skill directory or the agent file name. */
export function nameOf(doc: Document): string {
  if (typeof doc.frontmatter?.name === "string") return doc.frontmatter.name;
  return doc.kind === "skills" ? basename(doc.dir) : basename(doc.path, ".md");
}

/**
 * A tool list field as entries: a YAML list, or a string split on spaces and
 * commas outside parentheses, so `Bash(git add *, git commit *)` stays one entry.
 */
export function toolList(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((v): v is string => typeof v === "string");
  if (typeof value !== "string") return [];
  return value.match(/[^\s,(]+(?:\([^)]*\))?/g) ?? [];
}

// The host runs `!`...`` when `!` opens a line or follows whitespace, and a
// fence opened with ```! as one multi-line block; inside other fences too.
const INLINE_BLOCK = /(?:^|\s)!`/;
const FENCED_BLOCK = /^\s{0,3}`{3,}!/;

/** Whether a body line holds a `!` block. */
export const isBlockLine = (line: string): boolean =>
  INLINE_BLOCK.test(line) || FENCED_BLOCK.test(line);

/** The 1-based body lines that hold a `!` block. */
export function blockLines(doc: Document): number[] {
  const out: number[] = [];
  for (let i = doc.bodyStart - 1; i < doc.lines.length; i++) {
    if (isBlockLine(doc.lines[i] ?? "")) out.push(i + 1);
  }
  return out;
}

/** `a`, `a` and `b`, `a`, `b` and `c`, each backticked. */
export function listOf(items: string[]): string {
  const ticked = items.map((item) => `\`${item}\``);
  const last = ticked.pop() ?? "";
  return ticked.length === 0 ? last : `${ticked.join(", ")} and ${last}`;
}

export const isStringList = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((v) => typeof v === "string");

export const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.trim() !== "";

/** Why `source` does not compile as a regular expression, or undefined. */
export function regexProblem(source: string): string | undefined {
  try {
    new RegExp(source);
    return undefined;
  } catch {
    return `\`${source}\` is not a valid regular expression`;
  }
}

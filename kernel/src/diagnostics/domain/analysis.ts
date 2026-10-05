// The checks `bdk diagnostics write` runs on an analysis (`kernel-cli/diagnostics`,
// bdk diagnostics write; design D9 of v3-t47-run-diagnostics): the five
// headings, and in `## For a BDK issue` no fenced block, no code span outside
// the BDK vocabulary, and (checked against git by the use case) no line equal
// to a line of a tracked file.

const HEADINGS = [
  "## Summary",
  "## What went well",
  "## What went wrong",
  "## Where the fix belongs",
  "## For a BDK issue",
] as const;

export const ISSUE_HEADING = "## For a BDK issue";
/** Shorter lines are too common to mean a quote. */
const QUOTE_MIN_CHARS = 20;

const FENCE = /^\s*(```|~~~)/;
const CODE_SPAN = /(`+)([^`]|[^`][\s\S]*?[^`])\1(?!`)/g;
const TICKET = /^A-[0-9a-z]{8}(@[a-z0-9-]+)?$/;
const LEDGER = /^L-[0-9a-z]{8}$/;
const BDK_NAME = /^\/?bdk:[a-z0-9-]+$/;
const BDK_PATH = /^(\.bdk\/|\$\{CLAUDE_PLUGIN_ROOT\})/;

export interface Vocabulary {
  readonly rules: ReadonlySet<string>;
  readonly roles: ReadonlySet<string>;
  readonly settingsKeys: ReadonlySet<string>;
}

/** One line of the issue section with its 1-based line in the whole Markdown. */
export interface SectionLine {
  readonly line: number;
  readonly text: string;
}

export interface Violation {
  readonly line: number;
  readonly check: string;
}

/** The first required heading the Markdown lacks, or undefined. */
export function missingHeading(markdown: string): string | undefined {
  const lines = new Set(markdown.split("\n").map((line) => line.trimEnd()));
  return HEADINGS.find((heading) => !lines.has(heading));
}

/** The lines after `## For a BDK issue` up to the next `## ` heading. */
export function issueSection(markdown: string): SectionLine[] {
  const lines = markdown.split("\n");
  const start = lines.findIndex((line) => line.trimEnd() === ISSUE_HEADING);
  if (start === -1) return [];
  const section: SectionLine[] = [];
  for (let index = start + 1; index < lines.length; index += 1) {
    const text = lines[index] ?? "";
    if (text.startsWith("## ")) break;
    section.push({ line: index + 1, text });
  }
  return section;
}

/** The first fenced block or code span outside the vocabulary, or undefined. */
export function checkSection(
  section: readonly SectionLine[],
  vocabulary: Vocabulary,
): Violation | undefined {
  for (const { line, text } of section) {
    if (FENCE.test(text)) return { line, check: "holds a fenced code block" };
    for (const match of text.matchAll(CODE_SPAN)) {
      const span = (match[2] ?? "").trim();
      if (!allowed(span, vocabulary)) {
        return {
          line,
          check: `has a code span that is not a bdk command, rule id, ticket or ledger id, role or adapter, settings key, BDK skill or BDK path`,
        };
      }
    }
  }
  return undefined;
}

function allowed(span: string, vocabulary: Vocabulary): boolean {
  return (
    span === "bdk" ||
    span.startsWith("bdk ") ||
    vocabulary.rules.has(span) ||
    TICKET.test(span) ||
    LEDGER.test(span) ||
    vocabulary.roles.has(span) ||
    BDK_NAME.test(span) ||
    vocabulary.settingsKeys.has(span) ||
    BDK_PATH.test(span)
  );
}

/** The section lines long enough to be a quote of a tracked file, trimmed. */
export function quoteCandidates(section: readonly SectionLine[]): SectionLine[] {
  return section
    .map(({ line, text }) => ({ line, text: text.trim() }))
    .filter(({ text }) => text.length >= QUOTE_MIN_CHARS);
}

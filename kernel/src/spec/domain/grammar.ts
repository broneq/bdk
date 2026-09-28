// The spec grammar (`kernel-state`, Spec delta and Living spec file; D2b):
// level-2 sections, `### Requirement:` blocks, exactly `#### Scenario:`
// scenarios. Lines inside a code fence are never headings. Parsing
// normalises each line (LF, trailing whitespace trimmed), so a parsed block
// renders the same bytes however often it is read and written back.
import type { Problem } from "./reports.ts";

export interface Scenario {
  readonly name: string;
  /** 1-based line of the `#### Scenario:` heading. */
  readonly line: number;
  /** From the heading on, surrounding blank lines trimmed. */
  readonly lines: readonly string[];
}

export interface Requirement {
  readonly name: string;
  /** 1-based line of the `### Requirement:` heading. */
  readonly line: number;
  /** The heading and the statement, surrounding blank lines trimmed. */
  readonly head: readonly string[];
  readonly scenarios: readonly Scenario[];
}

/** A `## REMOVED Requirements` item: the whole requirement, or only the listed scenarios. */
interface Removal {
  readonly name: string;
  readonly line: number;
  readonly scenarios: readonly { readonly name: string; readonly line: number }[];
  /** The item as written, for a conflict's `ours` and `theirs`. */
  readonly text: string;
}

export interface Delta {
  readonly purpose?: { readonly text: string; readonly line: number };
  readonly added: readonly Requirement[];
  readonly modified: readonly Requirement[];
  readonly removed: readonly Removal[];
  /** Grammar problems: `scenario-prefix` and `section-unknown`. */
  readonly problems: readonly Problem[];
}

export interface LivingSpec {
  readonly purpose: string;
  readonly requirements: readonly Requirement[];
  /** `bdk-merge-hash`, when the frontmatter has it. */
  readonly hash?: string;
  /** `bdk-change`, when the frontmatter has it. */
  readonly change?: string;
  /** Everything after the frontmatter, as stored: what the hash covers. */
  readonly body: string;
}

const SECTIONS = [
  "Purpose",
  "ADDED Requirements",
  "MODIFIED Requirements",
  "REMOVED Requirements",
] as const;
type Section = (typeof SECTIONS)[number];

const SECTION = /^## (.*)$/;
const REQUIREMENT = /^### Requirement:\s*(\S.*)$/;
const LEVEL3 = /^###(?:\s|$)/;
const SCENARIO = /^#### Scenario: (\S.*)$/;
const FENCE = /^\s*(?:```|~~~)/;

interface Line {
  readonly text: string;
  readonly no: number;
  readonly fenced: boolean;
}

function linesOf(text: string, first = 1): Line[] {
  let fenced = false;
  return text
    .replaceAll("\r\n", "\n")
    .split("\n")
    .map((raw, index) => {
      const line = raw.trimEnd();
      const fence = FENCE.test(line);
      const result = { text: line, no: first + index, fenced: fenced || fence };
      if (fence) fenced = !fenced;
      return result;
    });
}

function trimBlank(lines: readonly string[]): string[] {
  let start = 0;
  let end = lines.length;
  while (start < end && lines[start] === "") start++;
  while (end > start && lines[end - 1] === "") end--;
  return lines.slice(start, end);
}

/** A line naming a scenario without being exactly `#### Scenario: <name>`. */
function malformedScenario(line: Line): boolean {
  if (line.fenced || SCENARIO.test(line.text)) return false;
  const bare = line.text.replace(/^[\s#>*+\-_]+/, "");
  return /^scenario\b[\s*_]*:/i.test(bare);
}

/** Splits lines into requirement blocks; lines before the first block or after a stray level-3 heading are dropped. */
function blocks(lines: readonly Line[]): Requirement[] {
  const found: Requirement[] = [];
  let current: { name: string; line: number; head: string[]; scenarios: Scenario[] } | undefined;
  let scenario: { name: string; line: number; lines: string[] } | undefined;
  const closeScenario = (): void => {
    if (current !== undefined && scenario !== undefined) {
      current.scenarios.push({ ...scenario, lines: trimBlank(scenario.lines) });
    }
    scenario = undefined;
  };
  const closeBlock = (): void => {
    closeScenario();
    if (current !== undefined) found.push({ ...current, head: trimBlank(current.head) });
    current = undefined;
  };
  for (const line of lines) {
    const requirement = line.fenced ? null : REQUIREMENT.exec(line.text);
    if (requirement !== null) {
      closeBlock();
      const name = (requirement[1] ?? "").trim();
      current = { name, line: line.no, head: [`### Requirement: ${name}`], scenarios: [] };
      continue;
    }
    if (!line.fenced && LEVEL3.test(line.text)) {
      closeBlock();
      continue;
    }
    if (current === undefined) continue;
    const heading = line.fenced ? null : SCENARIO.exec(line.text);
    if (heading !== null) {
      closeScenario();
      const name = (heading[1] ?? "").trim();
      scenario = { name, line: line.no, lines: [`#### Scenario: ${name}`] };
      continue;
    }
    if (scenario === undefined) current.head.push(line.text);
    else scenario.lines.push(line.text);
  }
  closeBlock();
  return found;
}

interface Split {
  readonly sections: Map<string, { readonly line: number; readonly lines: Line[] }>;
  readonly problems: Problem[];
}

/** Cuts the lines at level-2 headings; a heading not in `known` or given twice is `section-unknown`. */
function sectionsOf(lines: readonly Line[], known: readonly string[]): Split {
  const sections = new Map<string, { line: number; lines: Line[] }>();
  const problems: Problem[] = [];
  let current: Line[] | undefined;
  for (const line of lines) {
    const heading = line.fenced ? null : SECTION.exec(line.text);
    if (heading !== null) {
      const name = (heading[1] ?? "").trim();
      current = undefined;
      if (!known.includes(name)) {
        problems.push({
          line: line.no,
          code: "section-unknown",
          message: `section "${name}" is not one of ${known.map((item) => `"${item}"`).join(", ")}`,
        });
      } else if (sections.has(name)) {
        problems.push({
          line: line.no,
          code: "section-unknown",
          message: `section "${name}" is given twice`,
        });
      } else {
        current = [];
        sections.set(name, { line: line.no, lines: current });
      }
      continue;
    }
    current?.push(line);
  }
  return { sections, problems };
}

function removals(lines: readonly Line[]): Removal[] {
  const found: Removal[] = [];
  let current:
    { name: string; line: number; scenarios: { name: string; line: number }[] } | undefined;
  let text: string[] = [];
  const close = (): void => {
    if (current !== undefined) found.push({ ...current, text: trimBlank(text).join("\n") });
    current = undefined;
    text = [];
  };
  for (const line of lines) {
    const requirement = line.fenced ? null : REQUIREMENT.exec(line.text);
    if (requirement !== null) {
      close();
      const name = (requirement[1] ?? "").trim();
      current = { name, line: line.no, scenarios: [] };
      text.push(`### Requirement: ${name}`);
      continue;
    }
    if (!line.fenced && LEVEL3.test(line.text)) {
      close();
      continue;
    }
    if (current === undefined) continue;
    text.push(line.text);
    const scenario = line.fenced ? null : SCENARIO.exec(line.text);
    if (scenario !== null)
      current.scenarios.push({ name: (scenario[1] ?? "").trim(), line: line.no });
  }
  close();
  return found;
}

export function parseDelta(text: string): Delta {
  const lines = linesOf(text);
  const { sections, problems } = sectionsOf(lines, SECTIONS);
  const section = (name: Section) => sections.get(name);
  const purpose = section("Purpose");
  return {
    ...(purpose === undefined
      ? {}
      : {
          purpose: {
            text: trimBlank(purpose.lines.map((line) => line.text)).join("\n"),
            line: purpose.line,
          },
        }),
    added: blocks(section("ADDED Requirements")?.lines ?? []),
    modified: blocks(section("MODIFIED Requirements")?.lines ?? []),
    removed: removals(section("REMOVED Requirements")?.lines ?? []),
    problems: [...problems, ...lines.filter(malformedScenario).map(prefixProblem)].sort(
      (a, b) => a.line - b.line,
    ),
  };
}

function prefixProblem(line: Line): Problem {
  return {
    line: line.no,
    code: "scenario-prefix",
    message: `"${line.text.trim()}" names a scenario; write exactly "#### Scenario: <name>"`,
  };
}

const FIELD = /^(bdk-merge-hash|bdk-change):\s*(\S+)\s*$/;

/** A living spec file cut at its frontmatter (`shared/store`'s `splitFrontmatter`). */
export function parseLiving(frontmatter: string | undefined, body: string): LivingSpec {
  const fields = new Map<string, string>();
  for (const line of (frontmatter ?? "").split(/\r?\n/)) {
    const match = FIELD.exec(line);
    if (match?.[1] !== undefined && match[2] !== undefined) fields.set(match[1], match[2]);
  }
  const { sections } = sectionsOf(linesOf(body), ["Purpose", "Requirements"]);
  const hash = fields.get("bdk-merge-hash");
  const change = fields.get("bdk-change");
  return {
    purpose: trimBlank(sections.get("Purpose")?.lines.map((line) => line.text) ?? []).join("\n"),
    requirements: blocks(sections.get("Requirements")?.lines ?? []),
    ...(hash === undefined ? {} : { hash }),
    ...(change === undefined ? {} : { change }),
    body,
  };
}

/** The block as the living spec renders it: head, then scenarios, one blank line apart. */
export function blockText(requirement: Requirement): string {
  return [
    requirement.head.join("\n"),
    ...requirement.scenarios.map((s) => s.lines.join("\n")),
  ].join("\n\n");
}

/** The text between the requirement heading and its first scenario. */
export function statement(requirement: Requirement): string {
  return trimBlank(requirement.head.slice(1)).join("\n");
}

/** True when the scenario has a `- **WHEN**` (or `- **THEN**`) bullet outside a code fence. */
export function hasBullet(scenario: Scenario, word: "WHEN" | "THEN"): boolean {
  const bullet = `- **${word}**`;
  return linesOf(scenario.lines.join("\n")).some(
    (line) => !line.fenced && line.text.startsWith(bullet),
  );
}

// The view model of the human review report (`kernel-cli/review`, bdk review
// render; T42-H): sections built from the ledger, the plan parts, the evidence
// and the diff of the Change, never from a model's text. Pure, and every list
// in a fixed order, so the same inputs give the same report.

import { DISPOSITIONS, LEVELS } from "../../shared/vocabulary/index.ts";

const DECIDED_TYPES = new Set(["finding", "observation", "blocker"]);
const CONTEXT_TYPES = new Set(["decision", "assumption", "risk"]);
const LIVE = new Set(["proposed", "accepted"]);
const DECISION_GROUPS = ["should-fix", "nice-to-have", "untriaged"] as const;
const UNPLANNED = "unplanned";
/** `- <id>: <sentence>` under `## Areas`; a longer sentence is cut at this length. */
const AREA_SENTENCE_MAX = 300;
const HISTORY_LINE = /^(Resolved as|Triaged as|Decided) (\S+) at \S+(?:: (.*))?$/;
const BODY_LABELS = [
  ["problem", "Problem:"],
  ["why", "Why it matters:"],
  ["fix", "Suggested fix:"],
] as const;

export type Tracker = "github" | "instruction";

/** A ledger entry with its body, as the report reads it. */
export interface ReportEntry {
  readonly id: string;
  readonly type: string;
  readonly summary: string;
  readonly status: string;
  readonly source: string;
  readonly refs: readonly string[];
  readonly severity?: string | undefined;
  readonly category?: string | undefined;
  readonly level?: string | undefined;
  readonly disposition?: string | undefined;
  readonly issue?: string | undefined;
  readonly review?: boolean | undefined;
  readonly body: string;
}

interface ReportPart {
  readonly id: string;
  readonly title: string;
  readonly tasks: readonly {
    readonly id: string;
    readonly title: string;
    readonly files: readonly string[];
  }[];
}

export interface Lines {
  readonly added: number;
  readonly removed: number;
}

interface ReportFile extends Lines {
  readonly path: string;
}

export interface ReportCommit {
  readonly sha: string;
  readonly subject: string;
}

export interface CoverageInput {
  readonly tool: string;
  readonly min: number | null;
  readonly percent: number | null;
  readonly verdict: string | undefined;
}

export interface ReportInput {
  readonly change: string;
  readonly intent: string;
  readonly kind: string;
  readonly range: string;
  readonly files: readonly ReportFile[];
  readonly parts: readonly ReportPart[];
  /** The commits of the range per changed path, oldest first. */
  readonly commits: ReadonlyMap<string, readonly ReportCommit[]>;
  /** The enabled `review.risks` items, in settings order. */
  readonly risks: readonly {
    readonly id: string;
    readonly paths?: readonly string[] | undefined;
  }[];
  /** The `## Areas` lines of the integration reviewer, by risk id or `unplanned`. */
  readonly areas: ReadonlyMap<string, string>;
  /** The Change's entries ordered by `at`, then id. */
  readonly entries: readonly ReportEntry[];
  readonly gate: {
    readonly tests: string | undefined;
    readonly lint: string | undefined;
    readonly coverage: readonly CoverageInput[];
  };
  readonly tracker: Tracker | undefined;
  readonly moduleOf: (path: string) => string;
  readonly matches: (glob: string, path: string) => boolean;
}

interface GridCell extends Lines {
  readonly files: readonly string[];
  /** 0 to 4: the share of the busiest cell's lines, for the cell shade. */
  readonly weight: number;
}

export interface GridRow {
  readonly label: string;
  readonly part?: string | undefined;
  readonly cells: readonly (GridCell | undefined)[];
}

interface Tag {
  readonly id: string;
  readonly level?: string | undefined;
  readonly disposition?: string | undefined;
}

interface CardFile extends ReportFile {
  readonly tasks: readonly { readonly id: string; readonly title: string }[];
  readonly commits: readonly ReportCommit[];
  readonly tags: readonly Tag[];
}

export interface Card {
  /** The risk id, or `unplanned` for the files outside the plan. */
  readonly id: string;
  readonly summary?: string | undefined;
  readonly files: readonly CardFile[];
}

export type EntryBody =
  | {
      readonly kind: "labelled";
      readonly problem: string;
      readonly why: string;
      readonly fix: string;
    }
  | { readonly kind: "text"; readonly text: string };

export interface DecisionEntry {
  readonly id: string;
  readonly type: string;
  readonly summary: string;
  readonly refs: readonly string[];
  readonly severity?: string | undefined;
  readonly category?: string | undefined;
  readonly level?: string | undefined;
  readonly writer: string;
  readonly disposition?: string | undefined;
  readonly issue?: string | undefined;
  readonly review: boolean;
  readonly body: EntryBody;
  /** The triage, decision and resolution lines of the body, oldest first. */
  readonly history: readonly string[];
}

interface SettledEntry {
  readonly id: string;
  readonly type: string;
  readonly summary: string;
  readonly reason?: string | undefined;
}

export interface ChangeReport {
  readonly change: string;
  readonly intent: string;
  readonly kind: string;
  readonly range: string;
  readonly totals: Lines & { readonly files: number };
  readonly levels: Readonly<Record<string, number>>;
  readonly dispositions: Readonly<Record<string, number>>;
  readonly grid: { readonly modules: readonly string[]; readonly rows: readonly GridRow[] };
  readonly cards: readonly Card[];
  readonly gate: ReportInput["gate"];
  readonly decisions: readonly {
    readonly group: (typeof DECISION_GROUPS)[number];
    readonly entries: readonly DecisionEntry[];
  }[];
  readonly settled: readonly SettledEntry[];
  readonly context: readonly {
    readonly id: string;
    readonly type: string;
    readonly summary: string;
  }[];
  readonly tracker: Tracker | undefined;
}

export function changeReport(input: ReportInput): ChangeReport {
  const live = input.entries.filter((entry) => LIVE.has(entry.status));
  const open = live.filter((entry) => DECIDED_TYPES.has(entry.type));
  const owner = owners(input.files, input.parts);
  return {
    change: input.change,
    intent: input.intent,
    kind: input.kind,
    range: input.range,
    totals: {
      files: input.files.length,
      added: sum(input.files, "added"),
      removed: sum(input.files, "removed"),
    },
    levels: counts(
      open.map((entry) => entry.level ?? "untriaged"),
      [...LEVELS, "untriaged"],
    ),
    dispositions: counts(
      open.map((entry) => entry.disposition ?? "none"),
      [...DISPOSITIONS, "none"],
    ),
    grid: grid(input, owner),
    cards: cards(input, owner, open),
    gate: input.gate,
    decisions: DECISION_GROUPS.map((group) => ({
      group,
      entries: open
        .filter((entry) => entry.level !== "blocker")
        .filter((entry) => (entry.level ?? "untriaged") === group)
        .map(decisionEntry),
    })),
    settled: input.entries
      .filter((entry) => DECIDED_TYPES.has(entry.type) && entry.status === "resolved")
      .map((entry) => {
        const reason = splitBody(entry.body).history.at(-1)?.reason;
        return {
          id: entry.id,
          type: entry.type,
          summary: entry.summary,
          ...(reason === undefined ? {} : { reason }),
        };
      }),
    context: live
      .filter((entry) => CONTEXT_TYPES.has(entry.type))
      .map((entry) => ({ id: entry.id, type: entry.type, summary: entry.summary })),
    tracker: input.tracker,
  };
}

/**
 * The lines of the `## Areas` section of a report body, by id. A later
 * line for the same id wins; a sentence above 300 characters is cut.
 */
export function areaLines(body: string): Map<string, string> {
  const areas = new Map<string, string>();
  let inside = false;
  for (const line of body.split("\n")) {
    if (/^#{1,6}\s/.test(line)) {
      inside = /^##\s+Areas\s*$/.test(line);
      continue;
    }
    if (!inside) continue;
    const match = /^[-*]\s+([a-z0-9]+(?:-[a-z0-9]+)*):\s+(.+?)\s*$/.exec(line);
    if (match === null) continue;
    const [, id = "", sentence = ""] = match;
    areas.set(id, sentence.slice(0, AREA_SENTENCE_MAX));
  }
  return areas;
}

/** The labelled fields of a body, or its text, apart from its history lines. */
export function splitBody(body: string): {
  readonly body: EntryBody;
  readonly history: readonly { readonly line: string; readonly reason?: string | undefined }[];
} {
  const paragraphs = body
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter((paragraph) => paragraph !== "");
  const history = paragraphs.filter((paragraph) => HISTORY_LINE.test(paragraph));
  const text = paragraphs.filter((paragraph) => !HISTORY_LINE.test(paragraph));
  const fields = new Map<string, string>();
  for (const paragraph of text) {
    const label = BODY_LABELS.find(([, prefix]) => paragraph.startsWith(prefix));
    if (label !== undefined) fields.set(label[0], paragraph.slice(label[1].length).trim());
  }
  const labelled = BODY_LABELS.every(([key]) => fields.has(key));
  return {
    body: labelled
      ? {
          kind: "labelled",
          problem: fields.get("problem") ?? "",
          why: fields.get("why") ?? "",
          fix: fields.get("fix") ?? "",
        }
      : { kind: "text", text: text.join("\n\n") },
    history: history.map((line) => {
      const reason = HISTORY_LINE.exec(line)?.[3];
      return { line, ...(reason === undefined ? {} : { reason }) };
    }),
  };
}

function decisionEntry(entry: ReportEntry): DecisionEntry {
  const split = splitBody(entry.body);
  return {
    id: entry.id,
    type: entry.type,
    summary: entry.summary,
    refs: entry.refs,
    severity: entry.severity,
    category: entry.category,
    level: entry.level,
    writer: entry.source,
    disposition: entry.disposition,
    issue: entry.issue,
    review: entry.review === true,
    body: split.body,
    history: split.history.map((item) => item.line),
  };
}

/** The part that owns each changed file: the first whose tasks' `Files:` name it. */
function owners(files: readonly ReportFile[], parts: readonly ReportPart[]): Map<string, string> {
  const owner = new Map<string, string>();
  for (const file of files) {
    const part = parts.find((candidate) =>
      candidate.tasks.some((task) => task.files.includes(file.path)),
    );
    if (part !== undefined) owner.set(file.path, part.id);
  }
  return owner;
}

function grid(input: ReportInput, owner: ReadonlyMap<string, string>) {
  const modules = sorted(new Set(input.files.map((file) => input.moduleOf(file.path))));
  const rows: { label: string; part?: string; files: ReportFile[] }[] =
    input.parts.length === 0
      ? [{ label: "changed files", files: [...input.files] }]
      : [
          ...input.parts.map((part) => ({
            label: `${part.id} ${part.title}`,
            part: part.id,
            files: input.files.filter((file) => owner.get(file.path) === part.id),
          })),
          {
            label: "outside the plan",
            files: input.files.filter((file) => !owner.has(file.path)),
          },
        ];
  const cells = rows.map((row) =>
    modules.map((module) => row.files.filter((file) => input.moduleOf(file.path) === module)),
  );
  const busiest = Math.max(
    1,
    ...cells.flat().map((files) => sum(files, "added") + sum(files, "removed")),
  );
  return {
    modules,
    rows: rows.map((row, at) => ({
      label: row.label,
      ...(row.part === undefined ? {} : { part: row.part }),
      cells: (cells[at] ?? []).map((files) => {
        if (files.length === 0) return undefined;
        const added = sum(files, "added");
        const removed = sum(files, "removed");
        return {
          files: files.map((file) => file.path),
          added,
          removed,
          weight: Math.ceil(((added + removed) / busiest) * 4),
        };
      }),
    })),
  };
}

function cards(
  input: ReportInput,
  owner: ReadonlyMap<string, string>,
  open: readonly ReportEntry[],
): Card[] {
  const cardFile = (file: ReportFile, risk: string | undefined): CardFile => ({
    ...file,
    tasks: input.parts.flatMap((part) =>
      part.tasks
        .filter((task) => task.files.includes(file.path))
        .map((task) => ({ id: task.id, title: task.title })),
    ),
    commits: input.commits.get(file.path) ?? [],
    tags: open
      .filter((entry) =>
        entry.refs.some((ref) => {
          const name = ref.split("#")[0] ?? ref;
          return name === file.path || (risk !== undefined && name === risk);
        }),
      )
      .map((entry) => ({ id: entry.id, level: entry.level, disposition: entry.disposition })),
  });
  const result: Card[] = [];
  for (const risk of input.risks) {
    const files = input.files.filter((file) =>
      (risk.paths ?? []).some((glob) => input.matches(glob, file.path)),
    );
    const summary = input.areas.get(risk.id);
    if (files.length === 0 && summary === undefined) continue;
    result.push({
      id: risk.id,
      ...(summary === undefined ? {} : { summary }),
      files: files.map((file) => cardFile(file, risk.id)),
    });
  }
  const outside = input.files.filter((file) => !owner.has(file.path));
  if (input.parts.length > 0 && outside.length > 0) {
    const summary = input.areas.get(UNPLANNED);
    result.push({
      id: UNPLANNED,
      ...(summary === undefined ? {} : { summary }),
      files: outside.map((file) => cardFile(file, undefined)),
    });
  }
  return result;
}

function counts(values: readonly string[], keys: readonly string[]): Record<string, number> {
  return Object.fromEntries(
    keys.map((key) => [key, values.filter((value) => value === key).length]),
  );
}

function sum<K extends "added" | "removed">(items: readonly Record<K, number>[], key: K): number {
  return items.reduce((total, item) => total + item[key], 0);
}

function sorted(values: Iterable<string>): string[] {
  return [...values].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}

// The fold of a findings log into the current view (spec `bdk-cli/findings`, "Fold the log";
// design D3): one entry per id in the order of its first finding line, the last level and
// the last decision in file order, and every line that is no usable event reported, not fatal.
import { DECISIONS, event, LEVELS } from "./events.ts";
import type { Decision, DecisionEvent, Event, FindingEvent, Level, LevelEvent } from "./events.ts";

export interface Finding {
  readonly id: string;
  /** The source of the first report. */
  readonly source: string;
  /** Every source that reported this finding, in order of first appearance. */
  readonly sources: readonly string[];
  /** The number of `finding` lines with this id. */
  readonly reports: number;
  readonly summary: string;
  readonly file?: string;
  readonly line?: number;
  readonly rule?: string;
  readonly evidence?: string;
  readonly level: Level | null;
  readonly levelReason?: string;
  readonly decision: Decision | null;
  readonly issue?: string;
  readonly decisionReason?: string;
}

export interface Skipped {
  /** 1-based line number in the log. */
  readonly line: number;
  readonly reason: string;
}

export interface Counts {
  readonly findings: number;
  readonly level: Readonly<Record<Level | "unleveled", number>>;
  readonly decision: Readonly<Record<Decision | "undecided", number>>;
}

export interface View {
  readonly findings: readonly Finding[];
  readonly counts: Counts;
  readonly skipped: readonly Skipped[];
}

interface Numbered {
  readonly line: number;
  readonly event: Event;
}

function parse(text: string): { events: Numbered[]; skipped: Skipped[] } {
  const events: Numbered[] = [];
  const skipped: Skipped[] = [];
  text.split("\n").forEach((raw, index) => {
    if (raw.trim() === "") return;
    const line = index + 1;
    let value: unknown;
    try {
      value = JSON.parse(raw);
    } catch {
      skipped.push({ line, reason: "not valid JSON" });
      return;
    }
    const parsed = event.safeParse(value);
    if (parsed.success) events.push({ line, event: parsed.data });
    else skipped.push({ line, reason: `not an event: ${parsed.error.issues[0]?.message ?? ""}` });
  });
  return { events, skipped };
}

interface Draft {
  readonly first: FindingEvent;
  readonly sources: string[];
  reports: number;
  level?: LevelEvent;
  decision?: DecisionEvent;
}

/** `{ [key]: value }`, or nothing for an absent value, so absent fields stay out of the JSON. */
function optional<K extends string, V>(key: K, value: V | undefined): Partial<Record<K, V>> {
  return value === undefined ? {} : ({ [key]: value } as Partial<Record<K, V>>);
}

function finding({ first, sources, reports, level, decision }: Draft): Finding {
  return {
    id: first.id,
    source: first.source,
    sources,
    reports,
    summary: first.summary,
    ...optional("file", first.file),
    ...optional("line", first.line),
    ...optional("rule", first.rule),
    ...optional("evidence", first.evidence),
    level: level?.level ?? null,
    ...optional("levelReason", level?.reason),
    decision: decision?.decision ?? null,
    ...optional("issue", decision?.issue),
    ...optional("decisionReason", decision?.reason),
  };
}

export function fold(text: string): View {
  const { events, skipped } = parse(text);
  const drafts = new Map<string, Draft>();
  for (const { event } of events) {
    if (event.type !== "finding") continue;
    const known = drafts.get(event.id);
    if (known === undefined) {
      drafts.set(event.id, { first: event, sources: [event.source], reports: 1 });
    } else {
      if (!known.sources.includes(event.source)) known.sources.push(event.source);
      known.reports += 1;
    }
  }
  for (const { line, event } of events) {
    if (event.type === "finding") continue;
    const known = drafts.get(event.id);
    if (known === undefined) skipped.push({ line, reason: `no finding has the id ${event.id}` });
    else if (event.type === "level") known.level = event;
    else known.decision = event;
  }
  const all = [...drafts.values()].map(finding);
  const tally = <K extends string>(keys: readonly K[], of: (f: Finding) => K): Record<K, number> =>
    Object.fromEntries(keys.map((key) => [key, all.filter((f) => of(f) === key).length])) as Record<
      K,
      number
    >;
  return {
    findings: all,
    counts: {
      findings: all.length,
      level: tally([...LEVELS, "unleveled"], (f) => f.level ?? "unleveled"),
      decision: tally([...DECISIONS, "undecided"], (f) => f.decision ?? "undecided"),
    },
    skipped: skipped.sort((a, b) => a.line - b.line),
  };
}

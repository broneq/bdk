// The round metrics of review-models (#158, spec skill-evals, Review models
// measurement): what the integration reviewer and the judge cost, whether the
// judge ended before the gate, the reviewer groups that hold a binary file,
// the readers the guards denied, the report sections the contracts ask for
// and how much of the judge's package its verdicts cover. Pure functions over
// the facts the hook gathers from `bdk diagnostics report`, the run journal
// and the Change's reports and packages, so a recorded run measures again.
import type { ReviewEntry } from "./metrics.ts";

export interface RoundAgent {
  readonly agent: string;
  /** The role of its package, or null for an agent without one. */
  readonly role: string | null;
  readonly wallMs: number | null;
  readonly tokens: number | null;
  /** When it stopped (ISO 8601), from the journal; absent when it did not stop. */
  readonly stoppedAt?: string;
}

export interface RoundGuard {
  readonly agent: string;
  readonly rule: string;
}

/** A dispatch package of the round, from its frontmatter. */
export interface RoundPackage {
  readonly role: string;
  readonly group: string;
  readonly files: readonly string[];
  readonly entries: readonly string[];
}

/** A stored report of the round, from its frontmatter and body. */
export interface RoundReport {
  readonly role: string;
  readonly group: string;
  readonly body: string;
}

export interface RoundFacts {
  readonly agents: readonly RoundAgent[];
  readonly guards: readonly RoundGuard[];
  readonly packages: readonly RoundPackage[];
  readonly reports: readonly RoundReport[];
  /** The binary files of the reviewed range. */
  readonly binary: readonly string[];
}

/** The roles that read and must write no file: the reviewers and the judge. */
const READERS = new Set(["reviewer", "integration-reviewer", "judge"]);

const FAILURE_SCENARIO = /^Failure scenario:/m;

function heading(body: string, name: string): number {
  return body.search(new RegExp(`^## ${name}\\s*$`, "m"));
}

function section(body: string, name: string): string | undefined {
  const at = heading(body, name);
  if (at < 0) return undefined;
  const rest = body.slice(at).split("\n").slice(1).join("\n");
  const next = rest.search(/^## /m);
  return next < 0 ? rest : rest.slice(0, next);
}

/** The judge report's `## Verdicts` lines `- <id>: <level>: <reason>`, by id. */
export function verdictLines(body: string): Map<string, string> {
  const verdicts = new Map<string, string>();
  for (const line of (section(body, "Verdicts") ?? "").split("\n")) {
    const match = /^- (L-[A-Za-z0-9-]+): ([a-z-]+):/.exec(line.trim());
    if (match?.[1] !== undefined && match[2] !== undefined) verdicts.set(match[1], match[2]);
  }
  return verdicts;
}

function sum(values: readonly (number | null)[]): number | null {
  const known = values.filter((value): value is number => value !== null);
  return known.length === 0 ? null : known.reduce((total, value) => total + value, 0);
}

/** Wall seconds and tokens of the agents of one role, keys left out when unknown. */
function cost(agents: readonly RoundAgent[], role: string, name: string): Record<string, number> {
  const own = agents.filter((agent) => agent.role === role);
  const metrics: Record<string, number> = {};
  const wall = sum(own.map((agent) => agent.wallMs));
  const tokens = sum(own.map((agent) => agent.tokens));
  if (wall !== null) metrics[`${name}_wall_s`] = wall / 1000;
  if (tokens !== null) metrics[`${name}_tokens`] = tokens;
  return metrics;
}

function lastStop(agents: readonly RoundAgent[], role: string): string | undefined {
  return agents
    .filter((agent) => agent.role === role && agent.stoppedAt !== undefined)
    .map((agent) => agent.stoppedAt ?? "")
    .sort()
    .at(-1);
}

/** The judge's share of package entries whose verdict line names the level the entry holds. */
function verdictCoverage(
  facts: RoundFacts,
  entries: readonly ReviewEntry[],
): Record<string, number> {
  const listed = facts.packages
    .filter((item) => item.role === "judge")
    .flatMap((item) => item.entries);
  if (listed.length === 0) return {};
  const verdicts = new Map(
    facts.reports
      .filter((report) => report.role === "judge")
      .flatMap((report) => [...verdictLines(report.body)]),
  );
  const levels = new Map(entries.map((entry) => [entry.id, entry.level]));
  const covered = listed.filter((id) => {
    const level = verdicts.get(id);
    return level !== undefined && level === levels.get(id);
  }).length;
  return { verdict_coverage: covered / listed.length };
}

export function roundMetrics(
  facts: RoundFacts,
  entries: readonly ReviewEntry[],
): Record<string, number> {
  const roleOf = new Map(facts.agents.map((agent) => [agent.agent, agent.role]));
  const denials = (rule: string) =>
    facts.guards.filter(
      (guard) => guard.rule === rule && READERS.has(roleOf.get(guard.agent) ?? ""),
    ).length;
  const binary = new Set(facts.binary);
  const judgeStop = lastStop(facts.agents, "judge");
  const gateStop = lastStop(facts.agents, "runner");
  const integration = facts.reports.find((report) => report.role === "integration-reviewer");
  const intent = integration === undefined ? -1 : heading(integration.body, "Intent");
  const areas = integration === undefined ? -1 : heading(integration.body, "Areas");
  return {
    ...cost(facts.agents, "integration-reviewer", "integration"),
    ...cost(facts.agents, "judge", "judge"),
    ...(judgeStop === undefined || gateStop === undefined
      ? {}
      : { judge_before_gate: judgeStop <= gateStop ? 1 : 0 }),
    binary_groups: facts.packages.filter(
      (item) => item.role === "reviewer" && item.files.some((file) => binary.has(file)),
    ).length,
    reader_write_denials: denials("guard/reader-write"),
    judge_scope_denials: denials("guard/judge-scope"),
    reports_without_seams: facts.reports.filter(
      (report) => report.role === "reviewer" && heading(report.body, "Seams") < 0,
    ).length,
    intent_before_areas: intent >= 0 && areas > intent ? 1 : 0,
    findings_without_failure_scenario: entries.filter(
      (entry) =>
        (entry.type === "finding" || entry.type === "blocker") &&
        !FAILURE_SCENARIO.test(entry.body ?? ""),
    ).length,
    ...verdictCoverage(facts, entries),
  };
}

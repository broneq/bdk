// The deterministic report of one session (`kernel-cli/diagnostics`, bdk
// diagnostics report): scope, attribution, counts, metrics and detectors.
import { attribute, bashUses, HOST_AGENT, UNKNOWN_AGENT } from "./attribution.ts";
import type { Attribution } from "./attribution.ts";
import { detect } from "./detectors.ts";
import type { TaskOutlier } from "./detectors.ts";
import type {
  AgentFacts,
  AttemptFacts,
  CommandLine,
  NumberedLine,
  ParkFacts,
  Thresholds,
} from "./facts.ts";
import type {
  AgentMetrics,
  DiagnosticsReport,
  ModelTokens,
  PartMetrics,
  TaskMetrics,
  Tokens,
} from "./report.ts";
import { stageLines, windowSessions } from "./scope.ts";
import type { AgentTranscript, SessionTranscripts } from "./transcript.ts";

const TASK_LOOP = "task-redispatch";
const MAIN_AGENT = "main";

export interface ReportInput {
  readonly session: string;
  readonly stage: string | null;
  /** The whole journal; the report picks the session's lines. */
  readonly journal: readonly NumberedLine[];
  readonly agents: readonly AgentFacts[];
  readonly attempts: readonly AttemptFacts[];
  readonly parks: readonly ParkFacts[];
  readonly transcripts: SessionTranscripts;
  readonly thresholds: Thresholds;
  readonly suites: readonly string[];
  /** Task id to part id, from the plan. */
  readonly partOf: ReadonlyMap<string, string>;
  /** A record id's argv words, or undefined for an unknown id. */
  readonly verbOf: (command: string) => readonly string[] | undefined;
}

/** The report with the session's journal lines and transcript events it covers. */
export interface BuiltReport {
  readonly report: DiagnosticsReport;
  readonly lines: readonly NumberedLine[];
  /** Each transcript with only the events within the report's range. */
  readonly transcripts: readonly AgentTranscript[];
  /** The registry rows of the session. */
  readonly agents: readonly AgentFacts[];
  /** The agent and transcript use of each command line, by line number. */
  readonly attribution: ReadonlyMap<number, Attribution>;
}

export type ReportResult =
  BuiltReport | { readonly missing: "session" } | { readonly missing: "stage" };

export function buildReport(input: ReportInput): ReportResult {
  const { session, transcripts } = input;
  const ok = transcripts.state === "ok";
  const uses = ok ? bashUses(transcripts.agents) : [];
  const commandLines = input.journal.filter(isCommand);
  const attribution = attribute(commandLines, input.agents, uses, input.verbOf);
  const sessionAgents = new Set(transcripts.agents.map((agent) => agent.agent));
  const windows = windowSessions(input.journal);
  const all = input.journal.filter((line, index) => {
    if (windows[index] === session) return true;
    const use = attribution.get(line.n)?.use;
    return use !== null && use !== undefined && sessionAgents.has(use.agent);
  });
  if (all.length === 0) return { missing: "session" };
  const staged = input.stage === null ? { lines: all, end: null } : stageLines(all, input.stage);
  if (staged === undefined || staged.lines.length === 0) return { missing: "stage" };

  // The session runs from its first line or event to its last; a stage ends at the next stage.
  const scoped = staged.lines;
  const times = transcripts.agents.flatMap((agent) => agent.events.map((event) => event.at));
  const first = [scoped[0]?.at ?? "", ...(input.stage === null ? times : [])].sort()[0] ?? "";
  const from = input.stage === null ? first : (scoped[0]?.at ?? "");
  const end = staged.end;
  const inRange = (at: string) => at >= from && (end === null || at < end);
  const to = [...scoped.map((line) => line.at), ...times.filter(inRange)].sort().at(-1) ?? from;
  const lines = scoped.filter(isCommand);
  const agentOf = (line: CommandLine) => attribution.get(line.n)?.agent ?? UNKNOWN_AGENT;
  const rows = input.agents.filter((row) => row.session === session);
  const roleOf = roleLookup(rows);
  const attempts = input.attempts.filter((attempt) => inRange(attempt.openedAt));
  const parks = input.parks.filter((park) => inRange(park.at));
  const ranged = transcripts.agents.map((agent) => ({
    ...agent,
    events: agent.events.filter((event) => inRange(event.at)),
  }));

  const tokensOf = agentTokens(ranged, rows, ok);
  const agents = agentMetrics(rows, tokensOf, from, to);
  const holders = ticketHolders(rows);
  const citeAt = (at: string) =>
    `journal:${String((scoped.find((line) => line.at >= at) ?? scoped.at(-1))?.n ?? 0)}`;
  const tasks = taskMetrics(attempts, holders, tokensOf, input.partOf, to);
  const findings = detect({
    lines,
    attribution,
    transcripts: ranged,
    attempts,
    parks,
    thresholds: input.thresholds,
    suites: input.suites,
    taskAgents: new Set(
      rows.filter((row) => taskTickets(attempts).has(row.ticket ?? "")).map((row) => row.id),
    ),
    tasks: tasks.map((task) => outlier(task, attempts, holders, citeAt)),
    citeAt,
  });

  const refusals = lines.filter((line) => line.kind === "command" && line.rule !== null);
  const report: DiagnosticsReport = {
    session,
    change: changeOf(scoped),
    stage: input.stage,
    from,
    to,
    transcript: transcripts.state,
    unknownLines: transcripts.unknownLines,
    truncated: !input.journal.some((line) => line.kind === "session" && line.session === session),
    refusals: {
      total: refusals.length,
      byRule: tally(refusals.map((line) => line.rule ?? "")),
      byRole: tally(refusals.map((line) => roleOf(agentOf(line)))),
    },
    guardBlocks: lines.filter((line) => line.kind === "guard").length,
    retries: attempts.filter((attempt) => attempt.attempt > 1 && !attempt.escalation).length,
    escalations: attempts.filter((attempt) => attempt.escalation).length,
    parks: parks.length,
    questions: scoped.reduce((sum, line) => sum + (line.kind === "question" ? line.count : 0), 0),
    agents: agents.map(({ metrics }) => metrics),
    tasks: tasks.map(({ metrics }) => metrics),
    parts: partMetrics(tasks, attempts, holders, tokensOf, input.partOf, to),
    tokensUnknownAgents: agents.filter(({ metrics }) => metrics.tokens === null).length,
    cost: transcripts.cost,
    findings,
    anomalies: findings.length,
  };
  return { report, lines: scoped, transcripts: ranged, agents: rows, attribution };
}

function isCommand(line: NumberedLine): line is CommandLine {
  return line.kind === "command" || line.kind === "guard";
}

function roleLookup(rows: readonly AgentFacts[]): (agent: string) => string {
  const roles = new Map(rows.map((row) => [row.id, row.role ?? row.type ?? UNKNOWN_AGENT]));
  return (agent) =>
    agent === MAIN_AGENT || agent === HOST_AGENT || agent === UNKNOWN_AGENT
      ? agent
      : (roles.get(agent) ?? UNKNOWN_AGENT);
}

/**
 * Tokens per agent id. Null when the session's transcripts are not `ok`, when
 * a subagent ended without `SubagentStop`, or when its file is not there.
 */
function agentTokens(
  transcripts: readonly AgentTranscript[],
  rows: readonly AgentFacts[],
  ok: boolean,
): (agent: string) => Tokens {
  const byAgent = new Map(
    transcripts.map((transcript) => [transcript.agent, sumUsage(transcript)]),
  );
  const stopped = new Set(
    rows.filter((row) => row.endedBy === "subagent-stop").map((row) => row.id),
  );
  return (agent) => {
    if (!ok) return null;
    if (agent !== MAIN_AGENT && !stopped.has(agent)) return null;
    return byAgent.get(agent) ?? null;
  };
}

function sumUsage(transcript: AgentTranscript): Record<string, ModelTokens> {
  const tokens: Record<string, ModelTokens> = {};
  for (const event of transcript.events) {
    if (event.kind !== "usage") continue;
    tokens[event.model] = addTokens(tokens[event.model], event.tokens);
  }
  return tokens;
}

function addTokens(a: ModelTokens | undefined, b: ModelTokens): ModelTokens {
  return {
    input: (a?.input ?? 0) + b.input,
    output: (a?.output ?? 0) + b.output,
    cacheRead: (a?.cacheRead ?? 0) + b.cacheRead,
    cacheWrite: (a?.cacheWrite ?? 0) + b.cacheWrite,
  };
}

/** The sum of several agents' tokens; null when any of them is unknown. */
function sumTokens(parts: readonly Tokens[]): Tokens {
  const total: Record<string, ModelTokens> = {};
  for (const tokens of parts) {
    if (tokens === null) return null;
    for (const [model, each] of Object.entries(tokens))
      total[model] = addTokens(total[model], each);
  }
  return total;
}

function totalTokens(tokens: Tokens): number | null {
  if (tokens === null) return null;
  return Object.values(tokens).reduce(
    (sum, each) => sum + each.input + each.output + each.cacheRead + each.cacheWrite,
    0,
  );
}

function agentMetrics(
  rows: readonly AgentFacts[],
  tokensOf: (agent: string) => Tokens,
  from: string,
  to: string,
): { readonly metrics: AgentMetrics }[] {
  const main: AgentMetrics = {
    agent: MAIN_AGENT,
    type: MAIN_AGENT,
    role: null,
    wallMs: span(from, to),
    tokens: tokensOf(MAIN_AGENT),
  };
  return [
    { metrics: main },
    ...rows.map((row) => ({
      metrics: {
        agent: row.id,
        type: row.type ?? UNKNOWN_AGENT,
        role: row.role,
        wallMs:
          row.startedAt === null || row.endedAt === null ? null : span(row.startedAt, row.endedAt),
        tokens: tokensOf(row.id),
      },
    })),
  ];
}

function ticketHolders(rows: readonly AgentFacts[]): ReadonlyMap<string, readonly string[]> {
  const holders = new Map<string, string[]>();
  for (const row of rows) {
    if (row.ticket === null) continue;
    holders.set(row.ticket, [...(holders.get(row.ticket) ?? []), row.id]);
  }
  return holders;
}

function taskTickets(attempts: readonly AttemptFacts[]): Set<string> {
  return new Set(
    attempts.filter((attempt) => attempt.loop === TASK_LOOP).map((attempt) => attempt.ticket),
  );
}

interface TaskRow {
  readonly metrics: TaskMetrics;
  readonly tickets: readonly AttemptFacts[];
}

function taskMetrics(
  attempts: readonly AttemptFacts[],
  holders: ReadonlyMap<string, readonly string[]>,
  tokensOf: (agent: string) => Tokens,
  partOf: ReadonlyMap<string, string>,
  to: string,
): TaskRow[] {
  const byTask = new Map<string, AttemptFacts[]>();
  for (const attempt of attempts) {
    if (attempt.loop !== TASK_LOOP) continue;
    byTask.set(attempt.target, [...(byTask.get(attempt.target) ?? []), attempt]);
  }
  return [...byTask].map(([task, tickets]) => ({
    tickets,
    metrics: {
      task,
      part: partOf.get(task) ?? task.split("-")[0] ?? task,
      tickets: tickets.length,
      wallMs: wall(tickets, to),
      tokens: sumTokens(agentsOf(tickets, holders).map(tokensOf)),
    },
  }));
}

function partMetrics(
  tasks: readonly TaskRow[],
  attempts: readonly AttemptFacts[],
  holders: ReadonlyMap<string, readonly string[]>,
  tokensOf: (agent: string) => Tokens,
  partOf: ReadonlyMap<string, string>,
  to: string,
): PartMetrics[] {
  const parts = new Map<string, AttemptFacts[]>();
  for (const task of tasks) {
    parts.set(task.metrics.part, [...(parts.get(task.metrics.part) ?? []), ...task.tickets]);
  }
  const partIds = new Set(partOf.values());
  for (const attempt of attempts) {
    if (attempt.loop === TASK_LOOP || !partIds.has(attempt.target)) continue;
    parts.set(attempt.target, [...(parts.get(attempt.target) ?? []), attempt]);
  }
  return [...parts]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([part, tickets]) => ({
      part,
      wallMs: wall(tickets, to),
      tokens: sumTokens(agentsOf(tickets, holders).map(tokensOf)),
    }));
}

function agentsOf(
  tickets: readonly AttemptFacts[],
  holders: ReadonlyMap<string, readonly string[]>,
): string[] {
  return [...new Set(tickets.flatMap((ticket) => holders.get(ticket.ticket) ?? []))];
}

function wall(tickets: readonly AttemptFacts[], to: string): number {
  const opened = tickets.map((ticket) => ticket.openedAt).sort()[0] ?? to;
  const closed =
    tickets
      .map((ticket) => ticket.closedAt ?? to)
      .sort()
      .at(-1) ?? to;
  return span(opened, closed);
}

function outlier(
  task: TaskRow,
  attempts: readonly AttemptFacts[],
  holders: ReadonlyMap<string, readonly string[]>,
  citeAt: (at: string) => string,
): TaskOutlier {
  const last = task.tickets.at(-1) ?? attempts[0];
  const ticket = last?.ticket ?? "";
  const at = task.tickets[0]?.openedAt ?? "";
  return {
    task: task.metrics.task,
    wallMs: task.metrics.wallMs,
    tokens: totalTokens(task.metrics.tokens),
    agent: holders.get(ticket)?.[0] ?? MAIN_AGENT,
    ticket,
    at,
    cite: citeAt(at),
  };
}

function changeOf(lines: readonly NumberedLine[]): string | null {
  for (const line of [...lines].reverse())
    if ("change" in line && line.change !== null) return line.change;
  return null;
}

function tally(values: readonly string[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const value of values) counts[value] = (counts[value] ?? 0) + 1;
  return counts;
}

function span(from: string, to: string): number {
  return Math.max(0, Date.parse(to) - Date.parse(from));
}

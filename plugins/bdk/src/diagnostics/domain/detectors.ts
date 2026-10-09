// The waste detectors of `bdk diagnostics report` (design D6): deterministic checks over the
// events of one agent's transcript, and over the agents of a session. A finding cites
// `<file>:<line>` lines that resolve, and its summary never quotes a tool's output.

import type { Agent } from "./session.ts";
import type { ToolResult, ToolUse, Transcript } from "./transcript.ts";

export const DETECTORS = [
  "repeat-bash",
  "repeat-read",
  "repeat-skill",
  "retry-after-error",
  "refused",
  "timeout",
  "slow-call",
  "outlier",
  "missing-transcript",
] as const;

export type Detector = (typeof DETECTORS)[number];

export interface Finding {
  readonly detector: Detector;
  readonly agent: string;
  readonly agentType: string;
  /** How many times the pattern occurred. */
  readonly count: number;
  readonly summary: string;
  /** Up to `MAX_CITES` `<file>:<line>` citations, the first occurrence first. */
  readonly cites: readonly string[];
}

/** Thresholds (design D8): constants until a measurement asks for a setting. */
export const REPEAT_READS = 3;
export const OUTLIER_FACTOR = 3;
export const OUTLIER_MIN_AGENTS = 3;
/** A tool call that holds its agent this long (the host's default Bash timeout) is reported. */
export const SLOW_CALL_MS = 120_000;
/** Tools that wait for other agents by design; their time is the other agent's. */
const WAITING_TOOLS: ReadonlySet<string> = new Set(["Agent", "Task"]);
const MAX_CITES = 5;
const SHOWN_CHARS = 80;

const WRITE_TOOLS: ReadonlySet<string> = new Set(["Edit", "Write", "NotebookEdit", "MultiEdit"]);

/** Results of a call the permission system, a hook or the user refused. */
const REFUSED =
  /permission .* (?:denied|has been denied)|denied by|requires approval|doesn't want to proceed|hook error|^(?:<tool_use_error>)?blocked:/i;
const TIMED_OUT = /timed out/i;

export interface AgentTranscript {
  readonly agent: Agent;
  readonly file: string;
  readonly transcript: Transcript;
}

function field(input: unknown, key: string): unknown {
  return typeof input === "object" && input !== null
    ? (input as Record<string, unknown>)[key]
    : undefined;
}

/** A command as one short line; a launcher's absolute path (`".../bin/bdk"`) shows as its name. */
function shown(text: string): string {
  const line = text
    .replace(/"?(?:\/[^\s"/]+)+\/bin\/([A-Za-z0-9_-]+)"?/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
  return line.length > SHOWN_CHARS ? `${line.slice(0, SHOWN_CHARS - 3)}...` : line;
}

function cite(file: string, line: number): string {
  return `${file}:${String(line)}`;
}

/** Groups occurrences by key in first-seen order, keeping each group's citations. */
class Groups {
  private readonly groups = new Map<string, { summary: string; lines: number[] }>();

  add(key: string, summary: string, line: number): void {
    const group = this.groups.get(key) ?? { summary, lines: [] };
    group.lines.push(line);
    this.groups.set(key, group);
  }

  findings(
    detector: Detector,
    { agent, file }: AgentTranscript,
    summary: (text: string, count: number) => string,
  ): Finding[] {
    return [...this.groups.values()].map((group) => ({
      detector,
      agent: agent.id,
      agentType: agent.type,
      count: group.lines.length,
      summary: summary(group.summary, group.lines.length),
      cites: group.lines.slice(0, MAX_CITES).map((line) => cite(file, line)),
    }));
  }
}

function uses(transcript: Transcript): ToolUse[] {
  return transcript.events.filter((event): event is ToolUse => event.kind === "tool-use");
}

/** The same Bash command again with no write of that agent in between: cites each repeat. */
function repeatBash(at: AgentTranscript): Finding[] {
  const seen = new Set<string>();
  const groups = new Groups();
  for (const use of uses(at.transcript)) {
    if (WRITE_TOOLS.has(use.name)) {
      seen.clear();
      continue;
    }
    const command = use.name === "Bash" ? field(use.input, "command") : undefined;
    if (typeof command !== "string") continue;
    const key = command.trim();
    if (seen.has(key)) groups.add(key, key, use.line);
    seen.add(key);
  }
  return groups.findings(
    "repeat-bash",
    at,
    (command, count) =>
      `Bash command run again with no edit in between (${String(count)} repeat${count === 1 ? "" : "s"}): ${shown(command)}`,
  );
}

/** One file read `REPEAT_READS` times or more with no write to it in between: cites each read. */
function repeatRead(at: AgentTranscript): Finding[] {
  const reads = new Map<string, number[]>();
  const findings: Finding[] = [];
  const flush = (key: string, path: string): void => {
    const lines = reads.get(key) ?? [];
    if (lines.length >= REPEAT_READS) {
      findings.push({
        detector: "repeat-read",
        agent: at.agent.id,
        agentType: at.agent.type,
        count: lines.length,
        summary: `${path} read ${String(lines.length)} times with no write to it in between`,
        cites: lines.slice(0, MAX_CITES).map((line) => cite(at.file, line)),
      });
    }
    reads.delete(key);
  };
  const keyOf = (path: string, input: unknown): string =>
    JSON.stringify([path, field(input, "offset") ?? null, field(input, "limit") ?? null]);
  for (const use of uses(at.transcript)) {
    const path = field(use.input, "file_path");
    if (typeof path !== "string") continue;
    if (WRITE_TOOLS.has(use.name)) {
      for (const key of [...reads.keys()])
        if ((JSON.parse(key) as unknown[])[0] === path) flush(key, path);
    } else if (use.name === "Read") {
      const key = keyOf(path, use.input);
      reads.set(key, [...(reads.get(key) ?? []), use.line]);
    }
  }
  for (const key of [...reads.keys()]) flush(key, String((JSON.parse(key) as unknown[])[0]));
  return findings;
}

/** One skill loaded twice or more by one agent: cites each load after the first. */
function repeatSkill(at: AgentTranscript): Finding[] {
  const seen = new Set<string>();
  const groups = new Groups();
  for (const use of uses(at.transcript)) {
    const skill = use.name === "Skill" ? field(use.input, "skill") : undefined;
    if (typeof skill !== "string") continue;
    if (seen.has(skill)) groups.add(skill, skill, use.line);
    seen.add(skill);
  }
  return groups.findings(
    "repeat-skill",
    at,
    (skill, count) =>
      `skill ${skill} loaded again (${String(count)} more time${count === 1 ? "" : "s"})`,
  );
}

/** Results by tool use id, and the classification of each failed one. */
function failures(transcript: Transcript): Map<string, ToolResult> {
  const failed = new Map<string, ToolResult>();
  for (const event of transcript.events)
    if (event.kind === "tool-result" && event.error) failed.set(event.id, event);
  return failed;
}

/** A call repeated with the same input after it failed: cites each retry. */
function retryAfterError(at: AgentTranscript): Finding[] {
  const failed = failures(at.transcript);
  const failedInputs = new Set<string>();
  const groups = new Groups();
  for (const use of uses(at.transcript)) {
    const key = JSON.stringify([use.name, use.input]);
    if (failedInputs.has(key)) groups.add(key, use.name, use.line);
    if (failed.has(use.id)) failedInputs.add(key);
    else failedInputs.delete(key);
  }
  return groups.findings(
    "retry-after-error",
    at,
    (tool, count) =>
      `${tool} call repeated with the same input after it failed (${String(count)} time${count === 1 ? "" : "s"})`,
  );
}

/** Calls refused by the permission system, a hook or the user, and calls that timed out. */
function refusedAndTimedOut(at: AgentTranscript): Finding[] {
  const byId = new Map(uses(at.transcript).map((use) => [use.id, use]));
  const refused = new Groups();
  const timedOut = new Groups();
  for (const event of at.transcript.events) {
    if (event.kind !== "tool-result") continue;
    const tool = byId.get(event.id)?.name ?? "unknown";
    if (event.error && REFUSED.test(event.head)) refused.add(tool, tool, event.line);
    else if (TIMED_OUT.test(event.head)) timedOut.add(tool, tool, event.line);
  }
  return [
    ...refused.findings(
      "refused",
      at,
      (tool, count) => `${tool} call refused (${String(count)} time${count === 1 ? "" : "s"})`,
    ),
    ...timedOut.findings(
      "timeout",
      at,
      (tool, count) => `${tool} call timed out (${String(count)} time${count === 1 ? "" : "s"})`,
    ),
  ];
}

/** A tool call whose result came `SLOW_CALL_MS` or more after the call: cites the call. */
function slowCalls(at: AgentTranscript): Finding[] {
  const calls = new Map(uses(at.transcript).map((use) => [use.id, use]));
  const findings: Finding[] = [];
  for (const event of at.transcript.events) {
    if (event.kind !== "tool-result") continue;
    const use = calls.get(event.id);
    if (use === undefined || WAITING_TOOLS.has(use.name)) continue;
    const waited = Date.parse(event.at) - Date.parse(use.at);
    if (!(waited >= SLOW_CALL_MS)) continue;
    const command = use.name === "Bash" ? field(use.input, "command") : undefined;
    findings.push({
      detector: "slow-call",
      agent: at.agent.id,
      agentType: at.agent.type,
      count: 1,
      summary: `${use.name} call held the agent ${minutes(waited)}${typeof command === "string" ? `: ${shown(command)}` : ""}`,
      cites: [cite(at.file, use.line), cite(at.file, event.line)],
    });
  }
  return findings;
}

function median(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? (sorted[middle] ?? 0)
    : ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2;
}

function minutes(ms: number): string {
  return `${(ms / 60_000).toFixed(1)} min`;
}

/** Agents of one type far slower than the median of that type. */
function outliers(agents: readonly Agent[]): Finding[] {
  const byType = new Map<string, Agent[]>();
  for (const agent of agents) {
    if (agent.id === "main" || agent.wallMs === null) continue;
    byType.set(agent.type, [...(byType.get(agent.type) ?? []), agent]);
  }
  const findings: Finding[] = [];
  for (const [type, group] of byType) {
    if (group.length < OUTLIER_MIN_AGENTS) continue;
    const middle = median(group.map((agent) => agent.wallMs ?? 0));
    for (const agent of group) {
      if (middle <= 0 || (agent.wallMs ?? 0) < middle * OUTLIER_FACTOR || agent.file === null)
        continue;
      findings.push({
        detector: "outlier",
        agent: agent.id,
        agentType: type,
        count: 1,
        summary: `${minutes(agent.wallMs ?? 0)} wall, ${((agent.wallMs ?? 0) / middle).toFixed(1)} times the median ${minutes(middle)} of ${String(group.length)} ${type} agents`,
        cites: [`${agent.file}:1`],
      });
    }
  }
  return findings;
}

function missing(agents: readonly Agent[]): Finding[] {
  return agents
    .filter((agent) => agent.state === "missing")
    .map((agent) => ({
      detector: "missing-transcript" as const,
      agent: agent.id,
      agentType: agent.type,
      count: 1,
      summary: `no readable transcript for ${agent.type}${agent.description === null ? "" : ` "${agent.description}"`}: its tokens and cost are unknown, the other agents are counted`,
      cites: agent.startedBy === null ? [] : [agent.startedBy],
    }));
}

export function detect(
  transcripts: readonly AgentTranscript[],
  agents: readonly Agent[],
): Finding[] {
  return [
    ...transcripts.flatMap((at) => [
      ...repeatBash(at),
      ...repeatRead(at),
      ...repeatSkill(at),
      ...retryAfterError(at),
      ...refusedAndTimedOut(at),
      ...slowCalls(at),
    ]),
    ...outliers(agents),
    ...missing(agents),
  ];
}

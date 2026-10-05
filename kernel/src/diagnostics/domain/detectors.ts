// Detectors D1 to D8 (design D5 of v3-t47-run-diagnostics): deterministic
// checks over one session's journal lines and transcript events. A finding
// cites a journal line, a transcript line or a ledger id, and its summary
// never quotes tool output.
import type { Attribution } from "./attribution.ts";
import type { AttemptFacts, CommandLine, ParkFacts, Thresholds } from "./facts.ts";
import type { Finding } from "./report.ts";
import type { AgentTranscript, TranscriptEvent } from "./transcript.ts";

const WRITE_TOOLS: ReadonlySet<string> = new Set(["Edit", "Write", "NotebookEdit", "MultiEdit"]);
const SHOWN_CHARS = 80;
const MIN_OUTLIER_TASKS = 3;

/** Wall-time budgets of kernel commands, from their perf tests (`*.perf.ts`). */
const COMMAND_BUDGETS_MS: Readonly<Record<string, number>> = {
  next: 150,
  "hooks-pre-tool": 150,
  "hooks-prompt-expansion": 150,
  "hooks-post-tool": 150,
  "hooks-subagent-start": 150,
  "hooks-subagent-stop": 150,
  "hooks-stop": 150,
  "hooks-session-start": 1_000,
};

/** One task with what D8 compares. */
export interface TaskOutlier {
  readonly task: string;
  readonly wallMs: number;
  /** All tokens of all models, or null when unknown. */
  readonly tokens: number | null;
  readonly agent: string;
  readonly ticket: string;
  readonly at: string;
  readonly cite: string;
}

export interface DetectorInput {
  readonly lines: readonly CommandLine[];
  readonly attribution: ReadonlyMap<number, Attribution>;
  /** Transcript events within the report's time range, per agent. */
  readonly transcripts: readonly AgentTranscript[];
  readonly attempts: readonly AttemptFacts[];
  readonly parks: readonly ParkFacts[];
  readonly thresholds: Thresholds;
  /** The `command` of each whole-suite `tools.test` entry. */
  readonly suites: readonly string[];
  /** Agents holding a task package. */
  readonly taskAgents: ReadonlySet<string>;
  readonly tasks: readonly TaskOutlier[];
  /** The first journal line at or after a time, for findings without a line of their own. */
  readonly citeAt: (at: string) => string;
}

export function detect(input: DetectorInput): Finding[] {
  return [
    ...repeatedBash(input.transcripts),
    ...repeatedRefusal(input),
    ...frequentRule(input),
    ...wholeSuite(input),
    ...repeatedRead(input),
    ...secondTickets(input),
    ...repeatedSkill(input.transcripts),
    ...outliers(input),
  ].sort((a, b) => a.at.localeCompare(b.at) || a.cite.localeCompare(b.cite));
}

/** D1: the same Bash command again with no write of that agent in between. */
function repeatedBash(transcripts: readonly AgentTranscript[]): Finding[] {
  const findings: Finding[] = [];
  for (const transcript of transcripts) {
    const seen = new Map<string, number>();
    for (const event of transcript.events) {
      if (event.kind !== "tool-use") continue;
      if (WRITE_TOOLS.has(event.name)) {
        seen.clear();
        continue;
      }
      const command = event.name === "Bash" ? commandOf(event) : undefined;
      if (command === undefined) continue;
      const runs = (seen.get(command) ?? 0) + 1;
      seen.set(command, runs);
      if (runs < 2) continue;
      findings.push(
        transcriptFinding(
          "D1",
          transcript.agent,
          event,
          `Bash command run ${String(runs)} times with no edit between: ${shown(command)}`,
        ),
      );
    }
  }
  return findings;
}

/** D2: a refused kernel command repeated with the same arguments by the same agent. */
function repeatedRefusal(input: DetectorInput): Finding[] {
  const findings: Finding[] = [];
  const seen = new Set<string>();
  for (const line of input.lines) {
    if (line.rule === null || line.exit === 0) continue;
    const agent = input.attribution.get(line.n)?.agent ?? "unknown";
    const key = JSON.stringify([agent, line.command, line.args]);
    if (seen.has(key)) {
      findings.push(
        lineFinding(
          "D2",
          agent,
          line,
          `${line.command} refused again with the same arguments (${line.rule})`,
        ),
      );
    }
    seen.add(key);
  }
  return findings;
}

/** D3: one refusal rule seen at least `diagnostics.repeat-refusal` times. */
function frequentRule(input: DetectorInput): Finding[] {
  const counts = new Map<string, CommandLine[]>();
  for (const line of input.lines) {
    if (line.kind !== "command" || line.rule === null) continue;
    counts.set(line.rule, [...(counts.get(line.rule) ?? []), line]);
  }
  const findings: Finding[] = [];
  for (const [rule, lines] of counts) {
    const at = lines[input.thresholds.repeatRefusal - 1];
    if (at === undefined) continue;
    const agent = input.attribution.get(at.n)?.agent ?? "unknown";
    findings.push(lineFinding("D3", agent, at, `${rule} refused ${String(lines.length)} times`));
  }
  return findings;
}

/** D4: a whole-suite test command run by an agent that holds a task package. */
function wholeSuite(input: DetectorInput): Finding[] {
  const suites = new Set(input.suites.map((suite) => suite.trim()));
  const findings: Finding[] = [];
  for (const transcript of input.transcripts) {
    if (!input.taskAgents.has(transcript.agent)) continue;
    for (const event of transcript.events) {
      if (event.kind !== "tool-use" || event.name !== "Bash") continue;
      const command = commandOf(event)?.trim();
      if (command === undefined || !suites.has(command)) continue;
      findings.push(
        transcriptFinding(
          "D4",
          transcript.agent,
          event,
          `whole test suite run under a task package: ${shown(command)}`,
        ),
      );
    }
  }
  return findings;
}

/** D5: one file read at least `diagnostics.repeat-read` times with no write to it between. */
function repeatedRead(input: DetectorInput): Finding[] {
  const findings: Finding[] = [];
  for (const transcript of input.transcripts) {
    const reads = new Map<string, number>();
    for (const event of transcript.events) {
      if (event.kind !== "tool-use") continue;
      const path = pathOf(event);
      if (path === undefined) continue;
      if (WRITE_TOOLS.has(event.name)) {
        reads.delete(path);
        continue;
      }
      if (event.name !== "Read") continue;
      const count = (reads.get(path) ?? 0) + 1;
      reads.set(path, count);
      if (count !== input.thresholds.repeatRead) continue;
      findings.push(
        transcriptFinding(
          "D5",
          transcript.agent,
          event,
          `${shown(path)} read ${String(count)} times with no write between`,
        ),
      );
    }
  }
  return findings;
}

/** D6: a second ticket on one target, an escalation, or a park. */
function secondTickets(input: DetectorInput): Finding[] {
  const findings: Finding[] = [];
  const byTarget = new Map<string, AttemptFacts[]>();
  for (const attempt of input.attempts) {
    const key = `${attempt.loop} ${attempt.target}`;
    byTarget.set(key, [...(byTarget.get(key) ?? []), attempt]);
  }
  for (const attempts of byTarget.values()) {
    for (const [index, attempt] of attempts.entries()) {
      if (attempt.attempt < 2 && !attempt.escalation) continue;
      const before = attempts[index - 1];
      const kind = attempt.escalation ? "escalation" : `ticket ${String(attempt.attempt)}`;
      const reason =
        before === undefined || before.reason === "" ? "" : `: ${shown(before.reason)}`;
      findings.push({
        detector: "D6",
        agent: "main",
        ticket: attempt.ticket,
        at: attempt.openedAt,
        cite: input.citeAt(attempt.openedAt),
        summary: `${kind} on ${attempt.loop} ${attempt.target}${reason}`,
      });
    }
  }
  for (const park of input.parks) {
    findings.push({
      detector: "D6",
      agent: "main",
      ticket: null,
      at: park.at,
      cite: park.id,
      summary: "the Change parked",
    });
  }
  return findings;
}

/** D7: the same skill loaded twice in one agent. */
function repeatedSkill(transcripts: readonly AgentTranscript[]): Finding[] {
  const findings: Finding[] = [];
  for (const transcript of transcripts) {
    const seen = new Set<string>();
    for (const event of transcript.events) {
      if (event.kind !== "skill") continue;
      if (seen.has(event.name)) {
        findings.push(
          transcriptFinding("D7", transcript.agent, event, `skill ${event.name} loaded again`),
        );
      }
      seen.add(event.name);
    }
  }
  return findings;
}

/** D8: a task over k times the session median, and a kernel command over its budget. */
function outliers(input: DetectorInput): Finding[] {
  const findings: Finding[] = [];
  const factor = input.thresholds.outlierFactor;
  if (input.tasks.length >= MIN_OUTLIER_TASKS) {
    const wallMedian = median(input.tasks.map((task) => task.wallMs));
    const known = input.tasks.flatMap((task) => (task.tokens === null ? [] : [task.tokens]));
    const tokenMedian = known.length >= MIN_OUTLIER_TASKS ? median(known) : null;
    for (const task of input.tasks) {
      const slow = wallMedian > 0 && task.wallMs > factor * wallMedian;
      const heavy =
        tokenMedian !== null &&
        tokenMedian > 0 &&
        task.tokens !== null &&
        task.tokens > factor * tokenMedian;
      if (!slow && !heavy) continue;
      const what = [slow ? "wall time" : "", heavy ? "tokens" : ""].filter(Boolean).join(" and ");
      findings.push({
        detector: "D8",
        agent: task.agent,
        ticket: task.ticket,
        at: task.at,
        cite: task.cite,
        summary: `task ${task.task} ${what} over ${String(factor)} times the session median`,
      });
    }
  }
  for (const line of input.lines) {
    const budget = COMMAND_BUDGETS_MS[line.command];
    if (budget === undefined || line.ms <= budget) continue;
    const agent = input.attribution.get(line.n)?.agent ?? "unknown";
    findings.push(
      lineFinding(
        "D8",
        agent,
        line,
        `${line.command} took ${String(line.ms)} ms, over its ${String(budget)} ms budget`,
      ),
    );
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

function lineFinding(
  detector: Finding["detector"],
  agent: string,
  line: CommandLine,
  summary: string,
): Finding {
  return {
    detector,
    agent,
    ticket: line.ticket,
    at: line.at,
    cite: `journal:${String(line.n)}`,
    summary,
  };
}

function transcriptFinding(
  detector: Finding["detector"],
  agent: string,
  event: TranscriptEvent,
  summary: string,
): Finding {
  return {
    detector,
    agent,
    ticket: null,
    at: event.at,
    cite: `${agent}:${String(event.line)}`,
    summary,
  };
}

function commandOf(event: Extract<TranscriptEvent, { kind: "tool-use" }>): string | undefined {
  const command = (event.input as { command?: unknown } | null)?.command;
  return typeof command === "string" ? command : undefined;
}

function pathOf(event: Extract<TranscriptEvent, { kind: "tool-use" }>): string | undefined {
  const input = event.input as { file_path?: unknown; notebook_path?: unknown } | null;
  const path = input?.file_path ?? input?.notebook_path;
  return typeof path === "string" ? path : undefined;
}

function shown(text: string): string {
  const line = text.replace(/\s+/g, " ").trim();
  return line.length > SHOWN_CHARS ? `${line.slice(0, SHOWN_CHARS - 3)}...` : line;
}

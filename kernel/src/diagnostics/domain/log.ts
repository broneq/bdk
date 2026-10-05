// The verbose render of one session and the event lines `bdk diagnostics
// slice` prints (`kernel-cli/diagnostics`, bdk diagnostics log): every event
// of every transcript in time order, indented by agent depth, with the
// journal lines and the report's findings in between. Thinking never gets
// here: the transcript reader drops it.
import { shellCommands } from "./attribution.ts";
import type { NumberedLine } from "./facts.ts";
import type { DiagnosticsReport, Finding } from "./report.ts";
import { reportText } from "./text.ts";
import type { AgentTranscript, TranscriptEvent } from "./transcript.ts";

/** Lines kept of a skill, a prompt, an attachment or a tool result unless `--full`. */
const COLLAPSED_LINES = 20;
const INPUT_CHARS = 300;
const KERNEL_WORD = /(^|\/)bdk(\.mjs)?$/;

export interface EventOptions {
  readonly full: boolean;
  /** Tool use ids whose Bash command calls the kernel; their results print whole. */
  readonly kernelUses: ReadonlySet<string>;
}

/** The ids of the Bash tool uses that call the kernel. */
function kernelUses(transcripts: readonly AgentTranscript[]): Set<string> {
  const ids = new Set<string>();
  for (const transcript of transcripts) {
    for (const event of transcript.events) {
      if (event.kind !== "tool-use" || event.name !== "Bash") continue;
      const command = (event.input as { command?: unknown } | null)?.command;
      if (typeof command !== "string") continue;
      if (shellCommands(command).some((words) => words.some((word) => KERNEL_WORD.test(word)))) {
        ids.add(event.id);
      }
    }
  }
  return ids;
}

/** One event as lines: the first carries the time and the agent, the rest are indented. */
export function eventLines(
  event: TranscriptEvent,
  agent: string,
  indent: string,
  options: EventOptions,
): string[] {
  const head = `${clock(event.at)} ${indent}${agent}`;
  const body = (title: string, text: string, whole: boolean): string[] => {
    const lines = text.split("\n");
    const kept = whole || options.full ? lines : lines.slice(0, COLLAPSED_LINES);
    const more = lines.length - kept.length;
    return [
      `${head} ${title}${kept[0] === undefined || kept[0] === "" ? "" : ` ${kept[0]}`}`,
      ...kept.slice(1).map((line) => `${indent}    ${line}`),
      ...(more > 0 ? [`${indent}    ... ${String(more)} more lines`] : []),
    ];
  };
  switch (event.kind) {
    case "prompt":
      return body("prompt", event.text, false);
    case "text":
      return body("says", event.text, true);
    case "skill":
      return body(`skill ${event.name}`, event.text, false);
    case "attachment":
      return body(`attachment ${event.type}`, event.text ?? "", false);
    case "tool-use":
      return [`${head} ${event.name} ${inputLine(event, options.full)}`];
    case "tool-result":
      return body(
        event.error ? "result error" : "result",
        event.text,
        options.kernelUses.has(event.id),
      );
    case "usage":
      return [
        `${head} tokens ${event.model} in ${String(event.tokens.input)} out ${String(event.tokens.output)} cache-read ${String(event.tokens.cacheRead)} cache-write ${String(event.tokens.cacheWrite)}`,
      ];
  }
}

function inputLine(event: Extract<TranscriptEvent, { kind: "tool-use" }>, full: boolean): string {
  return toolInputLine(event.input, full ? Number.POSITIVE_INFINITY : INPUT_CHARS);
}

/** A tool input on one line: a Bash command, a lone file path, else the JSON; cut to `limit`. */
export function toolInputLine(input: unknown, limit: number): string {
  const fields = input as { command?: unknown; file_path?: unknown } | null;
  const text =
    typeof fields?.command === "string"
      ? fields.command
      : typeof fields?.file_path === "string" && Object.keys(fields).length === 1
        ? fields.file_path
        : JSON.stringify(input ?? null);
  const line = text.replace(/\s*\n\s*/g, " ");
  return line.length <= limit ? line : `${line.slice(0, limit - 3)}...`;
}

/** `HH:MM:SS` of an ISO time. */
function clock(at: string): string {
  return at.slice(11, 19) || "--:--:--";
}

export interface LogInput {
  readonly report: DiagnosticsReport;
  /** The session's journal lines within the report's range. */
  readonly lines: readonly NumberedLine[];
  readonly transcripts: readonly AgentTranscript[];
  /** Agent id to its parent's id, for the indent. */
  readonly parents: ReadonlyMap<string, string | null>;
  readonly full: boolean;
}

interface Entry {
  readonly at: string;
  readonly order: number;
  readonly lines: readonly string[];
  /** The cite a finding names to land right after this entry. */
  readonly cite: string;
}

export function renderLog(input: LogInput): string[] {
  const { report } = input;
  const session = input.lines.find((line) => line.kind === "session");
  const header = [
    `# BDK run log of session ${report.session}`,
    `change: ${report.change ?? "-"}`,
    `stage: ${report.stage ?? "-"}`,
    `start: ${report.from}`,
    `bdk: ${session?.kind === "session" ? `${session.bdk} ${session.commit ?? ""}`.trim() : "-"}`,
    `host: ${session?.kind === "session" ? (session.host ?? "-") : "-"}`,
    `transcript: ${report.transcript}${reason(report)}`,
    "",
  ];
  const entries: Entry[] = [];
  let order = 0;
  for (const line of input.lines) {
    const text = journalLine(line, report);
    if (text !== undefined) {
      entries.push({
        at: line.at,
        order: order++,
        lines: [text],
        cite: `journal:${String(line.n)}`,
      });
    }
  }
  if (report.transcript === "ok") {
    const options = { full: input.full, kernelUses: kernelUses(input.transcripts) };
    for (const transcript of input.transcripts) {
      const indent = "  ".repeat(depth(transcript.agent, input.parents));
      for (const event of transcript.events) {
        entries.push({
          at: event.at,
          order: order++,
          lines: eventLines(event, transcript.agent, indent, options),
          cite: `${transcript.agent}:${String(event.line)}`,
        });
      }
    }
  }
  entries.sort((a, b) => a.at.localeCompare(b.at) || a.order - b.order);
  const placed = new Set<Finding>();
  const byCite = new Map<string, Finding[]>();
  for (const finding of report.findings) {
    byCite.set(finding.cite, [...(byCite.get(finding.cite) ?? []), finding]);
  }
  const body: string[] = [];
  const unplaced = report.findings.filter(
    (finding) => !entries.some((entry) => entry.cite === finding.cite),
  );
  for (const entry of entries) {
    for (const finding of unplaced) {
      if (placed.has(finding) || finding.at > entry.at) continue;
      body.push(findingLine(finding));
      placed.add(finding);
    }
    body.push(...entry.lines);
    for (const finding of byCite.get(entry.cite) ?? []) {
      body.push(findingLine(finding));
      placed.add(finding);
    }
  }
  for (const finding of report.findings) if (!placed.has(finding)) body.push(findingLine(finding));
  return [...header, ...body, "", "# Counts", ...reportText(report).trimEnd().split("\n")];
}

function reason(report: DiagnosticsReport): string {
  switch (report.transcript) {
    case "ok":
      return "";
    case "missing":
      return " (a transcript file is gone; journal lines only)";
    case "unreadable":
      return ` (${String(report.unknownLines)} lines of an unknown shape; journal lines only)`;
    case "unavailable":
      return " (the host gave no transcript path; journal lines only)";
  }
}

function journalLine(line: NumberedLine, report: DiagnosticsReport): string | undefined {
  const time = line.at.slice(11, 19);
  switch (line.kind) {
    case "command":
    case "guard":
      return `${time} journal:${String(line.n)} ${line.kind === "guard" ? `guard ${line.agent} ` : ""}${line.command} ${line.args.join(" ")} exit ${String(line.exit)}${line.rule === null ? "" : ` ${line.rule}`}`.replace(
        /  +/g,
        " ",
      );
    case "agent-start":
      return `${time} journal:${String(line.n)} agent start ${line.agent} ${line.type}${line.ticket === null ? "" : ` ticket ${line.ticket}`}`;
    case "agent-stop": {
      const tokens = report.agents.find((agent) => agent.agent === line.agent)?.tokens;
      const total =
        tokens === undefined || tokens === null
          ? "tokens unknown"
          : `tokens ${String(Object.values(tokens).reduce((sum, each) => sum + each.input + each.output + each.cacheRead + each.cacheWrite, 0))}`;
      return `${time} journal:${String(line.n)} agent stop ${line.agent} by ${line.by} ${total}`;
    }
    case "question":
      return `${time} journal:${String(line.n)} question ${line.agent} ${String(line.count)} asked`;
    case "session":
      return `${time} journal:${String(line.n)} session ${line.source ?? "-"}`;
  }
}

function findingLine(finding: Finding): string {
  return `! ${finding.detector} ${finding.agent}${finding.ticket === null ? "" : ` ${finding.ticket}`} ${finding.cite}  ${finding.summary}`;
}

function depth(agent: string, parents: ReadonlyMap<string, string | null>): number {
  let level = 0;
  let current: string | null | undefined = agent;
  while (current !== undefined && current !== null && current !== "main" && level < 10) {
    level += 1;
    current = parents.get(current);
  }
  return level;
}

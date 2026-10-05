// Which journal lines belong to one session (design D2 of v3-t47-run-diagnostics).
// Kernel lines carry no session id, so a line without one belongs to the
// session of the latest `session` line before it; the report adds the lines
// whose matching `tool_use` sits in the session's transcripts.
import type { NumberedLine } from "./facts.ts";

/** The stage skills (`skills/stages/`), whose `ctx skill` lines bound `--stage`. */
export const STAGES = [
  "change",
  "close",
  "design",
  "execute",
  "plan",
  "run",
  "setup",
  "verify-design",
  "verify-plan",
] as const;

const STAGE_SET: ReadonlySet<string> = new Set(STAGES);

/** The session each line belongs to by its own field or, without one, by the window. */
export function windowSessions(lines: readonly NumberedLine[]): (string | null)[] {
  let current = lines.map(ownSession).find((session) => session !== null) ?? null;
  return lines.map((line) => {
    if (line.kind === "session") current = line.session;
    return ownSession(line) ?? current;
  });
}

function ownSession(line: NumberedLine): string | null {
  return "session" in line ? line.session : null;
}

/**
 * The session `bdk diagnostics report` reads without `--session`: the latest
 * session that ran a command of the active Change, else the latest session.
 */
export function defaultSession(
  lines: readonly NumberedLine[],
  activeChange: string | null,
): string | null {
  const sessions = windowSessions(lines);
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    const line = lines[index];
    const session = sessions[index] ?? null;
    if (line === undefined || session === null) continue;
    if (activeChange === null) return session;
    if ("change" in line && line.change === activeChange) return session;
  }
  return activeChange === null ? null : defaultSession(lines, null);
}

/** The main transcript and the agent transcripts the session's lines name. */
export function transcriptPaths(
  lines: readonly NumberedLine[],
  session: string,
): { readonly main: string | null; readonly agents: readonly string[] } {
  let main: string | null = null;
  const agents: string[] = [];
  for (const line of lines) {
    if (line.kind === "session" && line.session === session && line.transcript !== null) {
      main = line.transcript;
    }
    if (line.kind === "agent-stop" && line.session === session && line.transcript !== null) {
      agents.push(line.transcript);
    }
  }
  // Without its `session` line (halved away), the main file sits next to the agents' directory.
  const nested = /^(.*)\/subagents\/[^/]+\.jsonl$/.exec(agents[0] ?? "")?.[1];
  return { main: main ?? (nested === undefined ? null : `${nested}.jsonl`), agents };
}

/**
 * The lines of `--stage`, from the latest `ctx skill <stage>` line to the
 * next stage skill's line, and the time of that next line (null when the
 * stage ran to the end); undefined when the session never loaded the stage.
 */
export function stageLines(
  lines: readonly NumberedLine[],
  stage: string,
): { readonly lines: readonly NumberedLine[]; readonly end: string | null } | undefined {
  const starts = lines.flatMap((line, index) => (stageOf(line) === stage ? [index] : []));
  const start = starts.at(-1);
  if (start === undefined) return undefined;
  const next = lines.findIndex((line, index) => index > start && stageOf(line) !== undefined);
  return {
    lines: lines.slice(start, next === -1 ? undefined : next),
    end: next === -1 ? null : (lines[next]?.at ?? null),
  };
}

function stageOf(line: NumberedLine): string | undefined {
  if (line.kind !== "command" || line.command !== "ctx-skill" || line.exit !== 0) return undefined;
  const name = line.args.find((arg) => !arg.startsWith("-"));
  return name !== undefined && STAGE_SET.has(name) ? name : undefined;
}

/** The Change the session's lines name last, or null. */
export function sessionChange(lines: readonly NumberedLine[], session: string): string | null {
  const sessions = windowSessions(lines);
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    const line = lines[index];
    if (sessions[index] !== session || line === undefined || !("change" in line)) continue;
    if (line.change !== null) return line.change;
  }
  return null;
}

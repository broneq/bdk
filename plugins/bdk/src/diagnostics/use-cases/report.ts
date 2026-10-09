// `bdk diagnostics report`: the numbers and detector findings of the sessions of a Change, or of
// the sessions named, from the host's transcripts (spec `bdk-cli/diagnostics`).

import { resolve } from "node:path";

import { CliError } from "../../shared/cli/index.ts";
import type { Files } from "../../shared/fs/index.ts";
import { detect } from "../domain/detectors.ts";
import type { AgentTranscript } from "../domain/detectors.ts";
import { namesChange, transcriptsDir } from "../domain/location.ts";
import { buildSession } from "../domain/session.ts";
import type { SessionFiles } from "../domain/session.ts";
import type { ReportResult } from "../schema/report.ts";
import { readMainText, readSession, sessionIds } from "../store/transcripts.ts";

export interface DiagnosticsDeps {
  readonly files: Files;
  /** The project root: the working directory of the command. */
  readonly cwd: string;
  readonly home: string;
  readonly env: Readonly<Record<string, string | undefined>>;
}

export interface ReportInput {
  readonly change: string | undefined;
  readonly sessions: readonly string[];
  /** The transcripts directory; the host's directory of the project when absent. */
  readonly transcripts: string | undefined;
}

const CHANGE = /^[a-z0-9][a-z0-9-]*$/;

function agentTranscripts(
  files: SessionFiles,
  session: ReturnType<typeof buildSession>,
): AgentTranscript[] {
  const byId = new Map(session.agents.map((agent) => [agent.id, agent]));
  const main = byId.get("main");
  const list: AgentTranscript[] =
    main === undefined ? [] : [{ agent: main, file: files.file, transcript: files.main }];
  for (const sub of files.subagents) {
    const agent = byId.get(sub.id);
    if (agent !== undefined && sub.transcript !== null)
      list.push({ agent, file: sub.file, transcript: sub.transcript });
  }
  return list;
}

export function report(deps: DiagnosticsDeps, input: ReportInput): ReportResult {
  if (input.change === undefined && input.sessions.length === 0) {
    throw new CliError(
      "usage/no-run",
      "name a Change or at least one --session",
      "Run bdk diagnostics report <change>, or --session <id> for a session.",
    );
  }
  if (input.change !== undefined && !CHANGE.test(input.change)) {
    throw new CliError("usage/invalid-change", `${input.change}: must match ${CHANGE.source}`);
  }
  const dir =
    input.transcripts === undefined
      ? transcriptsDir({ cwd: deps.cwd, home: deps.home, configDir: deps.env.CLAUDE_CONFIG_DIR })
      : resolve(deps.cwd, input.transcripts);
  try {
    return count(deps, input, dir);
  } catch (error) {
    const code = (error as { code?: unknown }).code;
    if (code === "EACCES" || code === "EPERM") {
      throw new CliError(
        "env/transcripts-unreadable",
        `${dir}: not readable (${code})`,
        "Run it where the transcripts directory is readable, or copy it and pass --transcripts <dir>.",
      );
    }
    throw error;
  }
}

function count(deps: DiagnosticsDeps, input: ReportInput, dir: string): ReportResult {
  const ids = sessionIds(deps.files, dir);
  if (ids === undefined) {
    throw new CliError(
      "env/no-transcripts",
      `no transcripts directory: ${dir}`,
      "Pass --transcripts <dir> when the transcripts were copied elsewhere.",
    );
  }

  const warnings: string[] = [];
  const texts = new Map<string, string>();
  for (const id of input.sessions) {
    const text = readMainText(deps.files, dir, id);
    if (text === undefined) warnings.push(`session ${id}: no transcript ${id}.jsonl in ${dir}`);
    else texts.set(id, text);
  }
  if (input.change !== undefined) {
    const change = input.change;
    for (const id of ids) {
      if (texts.has(id)) continue;
      const text = readMainText(deps.files, dir, id);
      if (text !== undefined && namesChange(text, change)) texts.set(id, text);
    }
    if (texts.size === 0)
      warnings.push(
        `no session in ${dir} names .bdk/runs/${change}/ or openspec/changes/${change}`,
      );
  }

  const sessions = [...texts]
    .map(([id, text]) => {
      const files = readSession(deps.files, dir, id, text);
      const session = buildSession(files);
      const unknown = session.agents.filter((agent) => agent.unknownLines > 0);
      for (const agent of unknown)
        warnings.push(
          `${agent.file ?? agent.id}: ${String(agent.unknownLines)} line(s) of an unknown shape, not counted`,
        );
      if (session.cost === null)
        warnings.push(
          `session ${id}: no cost-state line (the session had not ended or crashed); cost unknown`,
        );
      const missing = session.agents.filter((agent) => agent.state === "missing").length;
      if (missing > 0 && session.cost !== null)
        warnings.push(
          `session ${id}: ${String(missing)} agent(s) without a transcript; their share of the host cost is spread over the agents counted`,
        );
      return { ...session, findings: detect(agentTranscripts(files, session), session.agents) };
    })
    .sort((a, b) => (a.start ?? "").localeCompare(b.start ?? ""));

  return { transcripts: dir, change: input.change ?? null, sessions, warnings };
}

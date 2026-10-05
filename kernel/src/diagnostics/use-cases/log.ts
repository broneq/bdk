// `bdk diagnostics log` (`kernel-cli/diagnostics`): renders one session into
// `.bdk/.machine/logs/<change>-<session>.log`, replacing an earlier render.
import { relative } from "node:path";

import { refuse } from "../../shared/refusal/index.ts";
import type { Refusal } from "../../shared/refusal/index.ts";
import type { ActiveChange } from "../../shared/registry/index.ts";
import { renderLog } from "../domain/log.ts";
import type { LogReport } from "../domain/report.ts";
import { sessionFileName, writeLogFile } from "./logs.ts";
import { sessionReport } from "./report.ts";
import type { DiagnosticsDeps, Place, SessionChoice } from "./report.ts";

export async function diagnosticsLog(
  deps: DiagnosticsDeps,
  place: Place,
  choice: SessionChoice & { readonly full: boolean },
  active: () => ActiveChange | Refusal,
): Promise<LogReport | Refusal> {
  const built = await sessionReport(deps, place, choice, active);
  if ("refused" in built) return built;
  const { report } = built;
  const parents = new Map(built.agents.map((agent) => [agent.id, agent.parent]));
  const lines = renderLog({
    report,
    lines: built.lines,
    transcripts: built.transcripts,
    parents,
    full: choice.full,
  });
  const written = writeLogFile(
    deps.store,
    place.projectRoot,
    `${sessionFileName(report.change, report.session)}.log`,
    lines,
  );
  return {
    path: relative(place.projectRoot, written.path),
    lines: written.lines,
    transcript: report.transcript,
  };
}

/** The render `hooks session-end` writes for its session when the verbose marker exists. */
export function writeSessionLog(
  deps: DiagnosticsDeps,
  place: Place,
  session: string,
): Promise<LogReport | Refusal> {
  // The session is named, so the active Change is never asked for.
  const active = () => refuse("input/not-found", "no session named", ["bdk diagnostics log"]);
  return diagnosticsLog(deps, place, { session, full: false }, active);
}

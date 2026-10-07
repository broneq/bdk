// `bdk run status`: the run, the parts of the current Change and the derived stage of every
// queued Change (spec `bdk-cli/run`).

import { join } from "node:path";

import { listFindings } from "../../findings/index.ts";
import type { Files } from "../../shared/fs/index.ts";
import { derive } from "../domain/status.ts";
import type { Fold } from "../domain/status.ts";
import type { StatusResult } from "../schema/status.ts";
import { readRun } from "../store/status.ts";

export interface RunDeps {
  readonly files: Files;
  /** The project root: the working directory of the command. */
  readonly cwd: string;
}

/** The last round's log folded by the `findings` slice; skipped lines become warnings. */
function lastRound({ files, cwd }: RunDeps, log: string | undefined, warnings: string[]): Fold {
  if (log === undefined) return { blockers: 0, fixes: 0 };
  const view = listFindings(files, { log: join(cwd, log) });
  for (const { line, reason } of view.skipped)
    warnings.push(`${log} line ${String(line)}: ${reason}, skipped`);
  return {
    blockers: view.findings.filter(
      (finding) => finding.level === "blocker" && finding.decision === null,
    ).length,
    fixes: view.findings.filter((finding) => finding.decision === "fix").length,
  };
}

export function status(deps: RunDeps): StatusResult {
  const run = readRun(deps.files, deps.cwd);
  const warnings: string[] = [];
  const changes = run.queue.map(({ change, issue }) => {
    const found = run.changes.get(change);
    if (found === undefined) throw new Error(`no files read for ${change}`);
    const { lastLog, ...snapshot } = found;
    const derived = derive({ ...snapshot, lastRound: lastRound(deps, lastLog, warnings) });
    return { change, issue, current: change === run.current, ...derived };
  });
  return {
    mode: run.mode,
    current: run.current,
    changes,
    parts: [...(run.changes.get(run.current)?.parts ?? [])],
    warnings,
  };
}

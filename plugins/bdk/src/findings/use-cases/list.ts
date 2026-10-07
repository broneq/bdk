import { CliError } from "../../shared/cli/index.ts";
import type { Files } from "../../shared/fs/index.ts";
import { DECISIONS, LEVELS } from "../domain/events.ts";
import { fold } from "../domain/fold.ts";
import type { ListResult } from "../schema/list.ts";
import { readLog } from "../store/log.ts";

export interface ListInput {
  readonly log: string;
  /** A level, or `unleveled` for findings without one. */
  readonly level?: string | undefined;
  /** A decision, or `undecided` for findings without one. */
  readonly decision?: string | undefined;
}

function choice(flag: string, value: string | undefined, values: readonly string[]): void {
  if (value !== undefined && !values.includes(value)) {
    throw new CliError(
      "usage/invalid-argument",
      `--${flag}: ${value} is none of ${values.join(", ")}`,
      "Run bdk findings list --help.",
    );
  }
}

/** Folds the log; the findings matching the filters, the counts and skipped lines of all. */
export function listFindings(files: Files, { log, level, decision }: ListInput): ListResult {
  choice("level", level, [...LEVELS, "unleveled"]);
  choice("decision", decision, [...DECISIONS, "undecided"]);
  const text = readLog(files, log);
  if (text === undefined) {
    throw new CliError(
      "env/log-dir-missing",
      `the directory of ${log} does not exist`,
      "Check the run directory and the round number in the path.",
    );
  }
  const view = fold(text);
  return {
    ...view,
    findings: view.findings.filter(
      (finding) =>
        (level === undefined || (finding.level ?? "unleveled") === level) &&
        (decision === undefined || (finding.decision ?? "undecided") === decision),
    ),
  };
}

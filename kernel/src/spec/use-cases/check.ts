// `bdk spec delta check [<capability>]` (`kernel-cli/spec`; T30-D8): every
// problem of every delta, or `policy/spec-invalid` listing them in `why`,
// because the error object has exactly four fields. The `spec-delta` and
// `plan-part` validators read the same problems through `deltaProblems`.
import { join, relative } from "node:path";

import type { Mapping } from "../../shared/config/index.ts";
import { refuse } from "../../shared/refusal/index.ts";
import type { Refusal } from "../../shared/refusal/index.ts";
import type { ActiveChange } from "../../shared/registry/index.ts";
import type { Store } from "../../shared/store/index.ts";
import { checkDelta } from "../domain/check.ts";
import { parseDelta } from "../domain/grammar.ts";
import type { CheckReport, DeltaReport } from "../domain/reports.ts";
import type { SpecDeps } from "./deps.ts";
import { listDeltas, normativeWord, readCurrent, specSettings } from "./files.ts";
import type { DeltaFile } from "./files.ts";

type ChangeRef = Pick<ActiveChange, "id" | "dir" | "projectRoot">;

export function checkDeltas(
  deps: SpecDeps,
  change: ActiveChange,
  globalDir: string,
  capability: string | undefined,
): CheckReport | Refusal {
  const settings = specSettings(deps, change.projectRoot, globalDir);
  if ("refused" in settings) return settings;
  const all = listDeltas(deps.store, change.dir);
  const deltas = capability === undefined ? all : all.filter((d) => d.capability === capability);
  if (capability !== undefined && deltas.length === 0) return notFound(change, capability);
  const reports = deltas.map((file) =>
    deltaReport(deps.store, change, file, normativeWord(settings.value)),
  );
  const invalid = reports.filter((report) => !report.valid);
  if (invalid.length > 0) return invalidRefusal(invalid);
  return { valid: true, deltas: reports };
}

export function deltaReport(
  store: Store,
  change: ChangeRef,
  file: DeltaFile,
  word: string,
): DeltaReport {
  const current = readCurrent(store, change.projectRoot, file.capability).living;
  const problems = checkDelta({ delta: file.delta, current, changeId: change.id, word });
  return {
    capability: file.capability,
    path: relative(change.projectRoot, file.path),
    valid: problems.length === 0,
    problems,
  };
}

/**
 * The problems of one delta as `<path>:<line> <code>: <message>`, or
 * undefined when the Change has no delta for `capability`; the graph's
 * validators read them (T30-D9).
 */
export function deltaProblems(
  store: Store,
  change: ChangeRef,
  capability: string,
  settings: Readonly<Mapping>,
): readonly string[] | undefined {
  const path = join(change.dir, "spec-delta", `${capability}.md`);
  const text = store.read(path);
  if (text === undefined) return undefined;
  const file = { capability, path, text, delta: parseDelta(text) };
  return problemLines(deltaReport(store, change, file, normativeWord(settings)));
}

/** The capabilities with a delta in the Change directory, in path order. */
export function deltaCapabilities(store: Store, changeDir: string): string[] {
  return listDeltas(store, changeDir).map((file) => file.capability);
}

function problemLines(report: DeltaReport): string[] {
  return report.problems.map(
    (problem) => `${report.path}:${problem.line} ${problem.code}: ${problem.message}`,
  );
}

/** Every problem of the reports, joined by `; `. */
function problemList(reports: readonly DeltaReport[]): string {
  return reports.flatMap(problemLines).join("; ");
}

export function invalidRefusal(reports: readonly DeltaReport[]): Refusal {
  const [first] = reports;
  return refuse("policy/spec-invalid", problemList(reports), [
    `fix ${first?.path ?? "the delta"}`,
    `bdk spec delta check ${first?.capability ?? ""}`.trimEnd(),
  ]);
}

export function notFound(change: ChangeRef, capability: string): Refusal {
  return refuse(
    "input/not-found",
    `${change.id} has no delta for ${capability} (spec-delta/${capability}.md)`,
    ["bdk spec delta check", "bdk spec diff"],
  );
}

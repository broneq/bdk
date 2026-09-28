// `bdk spec merge [--dry-run]` (`kernel-cli/spec`; T30-D5 to D7): the checks
// in contract order (hash, conflict, delta), then one canonical file per
// capability through `shared/store`, never a host tool (V1-7). `change close`
// runs `planMerge` and `writeMerge` itself, after its own checks.
import { relative } from "node:path";

import { refuse } from "../../shared/refusal/index.ts";
import type { Refusal } from "../../shared/refusal/index.ts";
import type { ActiveChange } from "../../shared/registry/index.ts";
import type { Store } from "../../shared/store/index.ts";
import { mergeDelta } from "../domain/merge.ts";
import { hashMatches, renderLiving } from "./living.ts";
import type { Conflict, MergeReport } from "../domain/reports.ts";
import { deltaReport, invalidRefusal } from "./check.ts";
import { findConflicts } from "./conflicts.ts";
import type { SpecDeps } from "./deps.ts";
import { listDeltas, normativeWord, readCurrent, specSettings } from "./files.ts";

type ChangeRef = Pick<ActiveChange, "id" | "dir" | "projectRoot">;

export interface MergePlan {
  readonly report: MergeReport;
  /** The files whose bytes change. */
  readonly writes: readonly { readonly path: string; readonly text: string }[];
}

export async function mergeSpecs(
  deps: SpecDeps,
  change: ActiveChange,
  globalDir: string,
  dryRun: boolean,
): Promise<MergeReport | Refusal> {
  if (!dryRun) {
    const gate = await deps.reviewGate(change, globalDir);
    if (gate !== undefined) return gate;
  }
  const settings = specSettings(deps, change.projectRoot, globalDir);
  if ("refused" in settings) return settings;
  const plan = planMerge(deps.store, change, normativeWord(settings.value), dryRun);
  if ("refused" in plan) return plan;
  if (!dryRun) writeMerge(deps.store, plan);
  return plan.report;
}

/** The checks and the merged files; nothing written. A dry run lists conflicts instead of refusing. */
export function planMerge(
  store: Store,
  change: ChangeRef,
  word: string,
  dryRun: boolean,
): MergePlan | Refusal {
  const deltas = listDeltas(store, change.dir).map((file) => ({
    file,
    current: readCurrent(store, change.projectRoot, file.capability),
  }));
  for (const { file, current } of deltas) {
    const living = current.living;
    if (living === undefined) continue;
    if (!hashMatches(living)) {
      const path = relative(change.projectRoot, current.path);
      return refuse(
        "policy/merge-hash-mismatch",
        living.hash === undefined
          ? `${path} was not written by the merge: it has no bdk-merge-hash`
          : `${path} was edited by hand: content hash differs from bdk-merge-hash`,
        [
          "move the manual edit into a spec delta of the Change",
          `bdk spec diff ${file.capability}`,
        ],
      );
    }
  }
  const files = deltas.map(({ file }) => file);
  const conflicts = findConflicts(store, change, files);
  if (conflicts.length > 0 && !dryRun) return conflictRefusal(change, conflicts);
  const invalid = files
    .map((file) => deltaReport(store, change, file, word))
    .filter((report) => !report.valid);
  if (invalid.length > 0) return invalidRefusal(invalid);

  const writes: { path: string; text: string }[] = [];
  const merged = deltas.map(({ file, current }) => {
    const result = mergeDelta(current.living, file.delta);
    const { text, hash } = renderLiving(file.capability, result, change.id);
    if (text !== current.text) writes.push({ path: current.path, text });
    return {
      capability: file.capability,
      path: relative(change.projectRoot, current.path),
      mergeHash: hash,
      ...result.counts,
    };
  });
  return { report: { merged, conflicts }, writes };
}

export function writeMerge(store: Store, plan: MergePlan): void {
  for (const { path, text } of plan.writes) store.write(path, text);
}

function conflictRefusal(change: ChangeRef, conflicts: readonly Conflict[]): Refusal {
  const why = conflicts
    .map((conflict) => {
      const other = conflict.theirs.slice(0, conflict.theirs.indexOf(":"));
      return `${conflict.capability} / ${conflict.requirement}: changed by ${change.id} and by ${other}, closed after ${change.id} began`;
    })
    .join("; ");
  const [first] = conflicts;
  const ref = `spec-delta/${first?.capability ?? "<capability>"}.md`;
  return refuse("policy/spec-conflict", why, [
    "bdk spec merge --dry-run --json",
    `rewrite ${ref} on top of .bdk/specs/${first?.capability ?? "<capability>"}/spec.md, then bdk log add decision "<summary>" --ref <other Change> --ref ${ref}`,
  ]);
}

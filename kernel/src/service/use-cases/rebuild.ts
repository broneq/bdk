// `bdk rebuild [--all]` (`kernel-cli/service`; T22 design D-12): the repair
// path behind every exit 4 and the step that lets a fresh clone resume, over
// the `shared/store` rebuild core. Change-scoped like every state command;
// `--all` widens it to every Change directory of the project.
import { performance } from "node:perf_hooks";

import type { Git } from "../../shared/git/index.ts";
import { refuse } from "../../shared/refusal/index.ts";
import type { Refusal } from "../../shared/refusal/index.ts";
import type { ActiveChange } from "../../shared/registry/index.ts";
import { listChangeDirs, rebuildChanges, withIndex } from "../../shared/store/index.ts";
import type { IndexOpener, Store } from "../../shared/store/index.ts";
import type { RebuildReport } from "../domain/report.ts";

export interface RebuildDeps {
  readonly store: Store;
  readonly git: Git;
  readonly openIndex: IndexOpener;
}

export function rebuild(
  deps: RebuildDeps,
  change: ActiveChange,
  input: { readonly all: boolean },
): Promise<RebuildReport | Refusal> {
  const locations = input.all
    ? listChangeDirs(deps.store, change.projectRoot)
    : [{ id: change.id, dir: change.dir, archived: false }];
  const started = performance.now();
  return withIndex(deps.openIndex, deps.store, change.projectRoot, async (index) => {
    const result = await rebuildChanges({ index, git: deps.git, locations });
    if (result.mismatches.length > 0) {
      return refuse("state/trailer-mismatch", result.mismatches.join("; "), [
        "fix the commit trailer or the plan part named, then run bdk rebuild again",
      ]);
    }
    return {
      changes: result.changes,
      entries: result.entries,
      attempts: result.attempts,
      commits: result.commits,
      migrated: result.migrated,
      durationMs: Math.round(performance.now() - started),
      warnings: result.warnings,
    };
  });
}

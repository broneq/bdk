// `bdk rebuild [--all]` (`kernel-cli/service`; T22 design D-12): the repair
// path behind every exit 4 and the step that lets a fresh clone resume, over
// the `shared/store` rebuild core. Change-scoped like every state command;
// `--all` widens it to every Change directory of the project.
import { performance } from "node:perf_hooks";

import { recoverWorktrees, worktreeSettings } from "../../part/index.ts";
import type { PartDeps, RecoveredWorktree } from "../../part/index.ts";
import { resolveOrRefuse } from "../../shared/config/index.ts";
import { KernelRefusal, refuse } from "../../shared/refusal/index.ts";
import type { Refusal } from "../../shared/refusal/index.ts";
import type { ActiveChange } from "../../shared/registry/index.ts";
import { listChangeDirs, rebuildChanges, withIndex } from "../../shared/store/index.ts";
import type { IndexDb } from "../../shared/store/index.ts";
import type { RebuildReport } from "../domain/report.ts";

/** The part slice's dependencies: worktree recovery reads the settings and runs the setup. */
export type RebuildDeps = PartDeps;

export function rebuild(
  deps: RebuildDeps,
  change: ActiveChange,
  input: { readonly all: boolean; readonly globalDir: string },
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
    const recovered = await recover(deps, index, change, locations, input.globalDir);
    return {
      changes: result.changes,
      entries: result.entries,
      attempts: result.attempts,
      commits: result.commits,
      migrated: result.migrated,
      durationMs: Math.round(performance.now() - started),
      warnings: [...result.warnings, ...recovered.warnings],
      worktrees: recovered.worktrees,
    };
  });
}

/**
 * Worktree recovery of every live Change in scope (T45 design D9); settings
 * that do not resolve skip it with a warning, since rebuild is the repair path.
 */
async function recover(
  deps: RebuildDeps,
  index: IndexDb,
  change: ActiveChange,
  locations: readonly { readonly id: string; readonly dir: string; readonly archived: boolean }[],
  globalDir: string,
): Promise<{ worktrees: RecoveredWorktree[]; warnings: string[] }> {
  const worktrees: RecoveredWorktree[] = [];
  const warnings: string[] = [];
  const projectRoot = change.projectRoot;
  let resolved;
  try {
    resolved = resolveOrRefuse(
      {
        store: deps.store,
        settings: deps.settings,
        globalDir,
        projectRoot,
        pluginRoot: deps.pluginRoot,
      },
      { removed: "ignore" },
    );
  } catch (error) {
    if (!(error instanceof KernelRefusal)) throw error;
    resolved = error.refusal;
  }
  if ("refused" in resolved) {
    return { worktrees, warnings: [`part worktrees not settled: ${resolved.why}`] };
  }
  const settings = worktreeSettings(resolved.value);
  for (const location of locations) {
    if (location.archived) continue;
    const found = await recoverWorktrees(deps, index, { ...location, projectRoot }, settings);
    worktrees.push(...found.worktrees);
    warnings.push(...found.warnings);
  }
  return { worktrees, warnings };
}

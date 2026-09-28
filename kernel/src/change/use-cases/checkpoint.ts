// `bdk change checkpoint` and the checkpoint `change park` runs (`kernel-loops`,
// Checkpoint; T22 design D-11): both go through the `shared/store` core. Only
// the explicit command turns an in-progress operation, an open ticket or a
// failing hook into its refusal; `park` reports them as skipped.
import { resolveOrRefuse } from "../../shared/config/index.ts";
import type { Mapping } from "../../shared/config/index.ts";
import { isRefusal } from "../../shared/refusal/index.ts";
import type { Refusal } from "../../shared/refusal/index.ts";
import type { ActiveChange } from "../../shared/registry/index.ts";
import { checkpointChange } from "../../shared/store/index.ts";
import type { Checkpoint } from "../../shared/store/index.ts";
import type { CheckpointReport, CheckpointView } from "../domain/change.ts";
import type { ChangeDeps } from "./deps.ts";

export async function checkpoint(
  deps: ChangeDeps,
  change: ActiveChange,
  globalDir: string,
): Promise<CheckpointReport | Refusal> {
  const settings = resolvedSettings(deps, change, globalDir);
  if (isRefusal(settings)) return settings;
  const result = await checkpointChange({
    store: deps.store,
    git: deps.git,
    projectRoot: change.projectRoot,
    change,
    settings,
  });
  if (!result.done && result.refusal !== undefined) return result.refusal;
  return { change: change.id, ...viewOf(result) };
}

/** The checkpoint an implicit caller runs: a skip is reported, never refused. */
export async function implicitCheckpoint(
  deps: ChangeDeps,
  change: ActiveChange,
  settings: Readonly<Mapping>,
): Promise<CheckpointView> {
  return viewOf(
    await checkpointChange({
      store: deps.store,
      git: deps.git,
      projectRoot: change.projectRoot,
      change,
      settings,
    }),
  );
}

export function resolvedSettings(
  deps: ChangeDeps,
  change: ActiveChange,
  globalDir: string,
): Readonly<Mapping> | Refusal {
  const resolved = resolveOrRefuse(
    {
      store: deps.store,
      settings: deps.settings,
      globalDir,
      projectRoot: change.projectRoot,
      pluginRoot: deps.pluginRoot,
    },
    { removed: "ignore" },
  );
  return "refused" in resolved ? resolved : resolved.value;
}

function viewOf(result: Checkpoint): CheckpointView {
  return result.done
    ? { done: true, commit: result.commit.slice(0, 7) }
    : { done: false, skipped: result.skipped };
}

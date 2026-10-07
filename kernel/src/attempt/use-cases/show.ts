// `bdk attempt show <ticket>` (`kernel-cli/attempt`): one ticket's record,
// read-only. The steps are the ones `attempt open` returned for a code loop.
import type { AttemptShowReport } from "../domain/reports.ts";
import { withChangeIndex } from "../../log/index.ts";
import { workTargets } from "../../part/index.ts";
import { resolveOrRefuse } from "../../shared/config/index.ts";
import { refuse } from "../../shared/refusal/index.ts";
import type { Refusal } from "../../shared/refusal/index.ts";
import type { ActiveChange } from "../../shared/registry/index.ts";
import { listEntries } from "../../shared/store/index.ts";
import type { AttemptDeps } from "./deps.ts";
import { item } from "./list.ts";
import { keyedRecords } from "./records.ts";

export function showAttempt(
  deps: AttemptDeps,
  change: ActiveChange,
  globalDir: string,
  ticket: string,
): Promise<AttemptShowReport | Refusal> {
  return withChangeIndex(deps, change, async (index) => {
    const record = keyedRecords(deps.store, change.dir).find((found) => found.ticket === ticket);
    if (record === undefined) {
      return refuse("input/not-found", `${change.id} has no ticket ${ticket}`, [
        "bdk attempt list",
      ]);
    }
    const entries = listEntries(index, change.id).filter((entry) => entry.ticket === ticket);
    const { base } = record.file.data;
    const shown = { ...item(record, entries), ...(base === undefined ? {} : { base }) };
    if (record.loop === "verifier") return shown;
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
    if ("refused" in resolved) return resolved;
    const targets = await workTargets(deps, change, index, globalDir);
    if ("refused" in targets) return targets;
    return { ...shown, steps: targets.steps };
  });
}

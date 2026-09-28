// The plan parts and their start markers as the part commands read them:
// the files through `shared/store`, the markers from the ledger.
import { refuse } from "../../shared/refusal/index.ts";
import type { Refusal } from "../../shared/refusal/index.ts";
import { readPlanParts } from "../../shared/store/index.ts";
import type { EntryRow, PlanPartFile, Store } from "../../shared/store/index.ts";

/** The plan parts of a Change, or `input/not-found` naming the ids when `id` is not one of them. */
export function partsWith(
  store: Store,
  changeDir: string,
  id: string,
): { parts: PlanPartFile[]; part: PlanPartFile } | Refusal {
  const parts = readPlanParts(store, changeDir);
  const part = parts.find((found) => found.id === id);
  if (part === undefined) {
    const known = parts.map((found) => found.id).join(", ");
    return refuse(
      "input/not-found",
      `plan/parts/ holds no part ${id}${known === "" ? "" : `; parts: ${known}`}`,
      ["bdk part list"],
    );
  }
  return { parts, part };
}

/** The ids of the parts with a `part start` marker (`execute-part:<nn>`, kernel, no `input-hash`). */
export function startedParts(entries: readonly EntryRow[]): Set<string> {
  const started = new Set<string>();
  for (const entry of entries) {
    if (entry.type !== "transition" || entry.source !== "kernel") continue;
    const nn = /^execute-part:(\d{2})$/.exec(entry.to ?? "")?.[1];
    if (nn !== undefined && entry.inputHash === undefined) started.add(nn);
  }
  return started;
}

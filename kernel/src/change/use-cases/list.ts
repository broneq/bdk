// `bdk change list`: the union of committed Change directories and local
// branch markers, newest `updatedAt` first.
import { listChanges, listMarkers, refreshAll, withIndex } from "../../shared/store/index.ts";
import { stageResolver } from "../../graph/index.ts";
import type { ListItem } from "../domain/change.ts";
import type { ChangeDeps } from "./deps.ts";
import { changeFacts } from "./facts.ts";

export function listAllChanges(
  deps: ChangeDeps,
  projectRoot: string,
  options: { readonly archived: boolean },
): Promise<ListItem[]> {
  return withIndex(deps.openIndex, deps.store, projectRoot, (index) => {
    refreshAll(index);
    const stageOfTarget = stageResolver(deps);
    const branches = new Map<string, string>();
    for (const marker of listMarkers(deps.store, projectRoot)) {
      if (!branches.has(marker.change)) branches.set(marker.change, marker.branch);
    }
    return listChanges(index)
      .filter((change) => options.archived || !change.archived)
      .map((change) => {
        const facts = changeFacts(index, change.id, stageOfTarget);
        const branch = branches.get(change.id);
        const state = change.archived
          ? "archived"
          : facts.parked === undefined
            ? "active"
            : "parked";
        return {
          change: change.id,
          ...(branch === undefined ? {} : { branch }),
          stage: facts.stage,
          state,
          kind: change.kind,
          profile: facts.profile,
          updatedAt: change.updatedAt,
        };
      });
  });
}

// `bdk change status`: the active Change at a glance, derived from the
// ledger. The graph fields stay empty until T21 and T22 (design D-14).
import { join } from "node:path";

import type { ActiveChange } from "../../shared/registry/index.ts";
import { openAttempts, readDocument, withIndex, refreshChange } from "../../shared/store/index.ts";
import { resumeCommand } from "../domain/change.ts";
import type { StatusReport } from "../domain/change.ts";
import type { ChangeDeps } from "./deps.ts";
import { changeFacts } from "./facts.ts";

export function changeStatus(deps: ChangeDeps, change: ActiveChange): Promise<StatusReport> {
  return withIndex(deps.openIndex, deps.store, change.projectRoot, (index) => {
    refreshChange(index, { id: change.id, dir: change.dir, archived: false });
    const document = readDocument(deps.store, join(change.dir, "change.md"));
    const data = document !== undefined && "data" in document ? document.data : {};
    const facts = changeFacts(index, change.id);
    return {
      change: change.id,
      kind: facts.kind,
      profile: facts.profile,
      source: facts.source,
      confirmed: facts.confirmed,
      stage: facts.stage,
      ...(facts.parked === undefined
        ? {}
        : {
            parked: {
              entry: facts.parked.id,
              options: facts.parked.options ?? [],
              resume: resumeCommand(change.id),
            },
          }),
      nodes: [],
      gates: [],
      parts: [],
      openTickets: openAttempts(index, change.id),
      overriddenKeys: Array.isArray(data.overridden) ? data.overridden.map(String) : [],
    };
  });
}

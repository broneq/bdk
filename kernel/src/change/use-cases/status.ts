// `bdk change status`: the active Change at a glance, derived from the
// ledger and its artifact graph; `parts` as `part list` reports them, and the
// open tickets whose package dropped rules at the cap.
import { join } from "node:path";

import { graphSummary, readGraph, stageResolver } from "../../graph/index.ts";
import { partItems } from "../../part/index.ts";
import type { Refusal } from "../../shared/refusal/index.ts";
import type { ActiveChange } from "../../shared/registry/index.ts";
import {
  openAttempts,
  readDocument,
  refreshChange,
  truncatedPackages,
  withIndex,
} from "../../shared/store/index.ts";
import { resumeCommand } from "../domain/change.ts";
import type { StatusReport } from "../domain/change.ts";
import type { ChangeDeps } from "./deps.ts";
import { changeFacts } from "./facts.ts";

export function changeStatus(
  deps: ChangeDeps,
  change: ActiveChange,
  globalDir: string,
): Promise<StatusReport | Refusal> {
  return withIndex(deps.openIndex, deps.store, change.projectRoot, async (index) => {
    refreshChange(index, { id: change.id, dir: change.dir, archived: false });
    const read = await readGraph(deps, change, index, globalDir);
    if ("refused" in read) return read;
    const graph = graphSummary(read);
    const document = readDocument(deps.store, join(change.dir, "change.md"));
    const data = document !== undefined && "data" in document ? document.data : {};
    const facts = changeFacts(index, change.id, stageResolver(deps));
    const tickets = openAttempts(index, change.id);
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
      nodes: graph.nodes,
      gates: graph.gates,
      parts: await partItems(deps, change, read),
      openTickets: tickets,
      rulesTruncated: truncatedPackages(index, change.id),
      overriddenKeys: Array.isArray(data.overridden) ? data.overridden.map(String) : [],
    };
  });
}

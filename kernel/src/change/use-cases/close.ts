// `bdk change close [--dry-run]` (`kernel-cli/change`; T30-D11, D12, T42-H):
// every check before the first write (the review gate, open tickets,
// undecided entries, trailers, git state, then the merge's own checks), then the merge, the `close`
// transition, the prune, the move into the archive, the marker removal and
// one pathspec commit of exactly the paths it touched.
import { relative, sep } from "node:path";

import { gateRefusal, readGraph, writeDoneMarker } from "../../graph/index.ts";
import { withChangeIndex } from "../../log/index.ts";
import { moduleValue } from "../../shared/config/index.ts";
import { changedPaths, gitInProgress, pathspecCommit } from "../../shared/git/index.ts";
import { isRefusal, refuse } from "../../shared/refusal/index.ts";
import type { Refusal } from "../../shared/refusal/index.ts";
import type { ActiveChange } from "../../shared/registry/index.ts";
import {
  archivedChangeDir,
  findChangeRow,
  listEntries,
  openAttempts,
  pruneChange,
  readAttempts,
  readPlanParts,
  rebuildChange,
  removeMarker,
  taskProgress,
} from "../../shared/store/index.ts";
import type { EntryRow, IndexDb } from "../../shared/store/index.ts";
import { normativeWord, planMerge, writeMerge } from "../../spec/index.ts";
import type { MergePlan } from "../../spec/index.ts";
import { archiveModule } from "../config.ts";
import type { CloseReport } from "../domain/change.ts";
import { closeSummary } from "../domain/close.ts";
import { resolvedSettings } from "./checkpoint.ts";
import type { ChangeDeps } from "./deps.ts";

const DONE = new Set(["superseded", "resolved"]);
const DECIDED_TYPES = new Set(["finding", "observation", "blocker"]);

export function closeChange(
  deps: ChangeDeps,
  change: ActiveChange,
  globalDir: string,
  input: { readonly dryRun: boolean },
): Promise<CloseReport | Refusal> {
  const settings = resolvedSettings(deps, change, globalDir);
  if (isRefusal(settings)) return Promise.resolve(settings);
  return withChangeIndex(deps, change, async (index) => {
    const blocked = await checks(deps, change, index, globalDir);
    if (blocked !== undefined) return blocked;
    const plan = planMerge(deps.store, change, normativeWord(settings), false);
    if (isRefusal(plan)) return plan;

    const target = archivedChangeDir(change.projectRoot, change.id);
    const report = closeReport(change, index, plan, relativePath(change.projectRoot, target));
    if (input.dryRun) return report;

    writeMerge(deps.store, plan);
    const graph = await readGraph(deps, change, index, globalDir);
    if (isRefusal(graph)) return graph;
    const node = graph.graph.find("close");
    if (node === undefined) throw new Error(`${change.id} has no close node`);
    const marker = await writeDoneMarker(deps, change, index, graph, node);
    if (isRefusal(marker)) return marker;
    if (!moduleValue(archiveModule, settings)["keep-evidence"]) {
      pruneChange(deps.store, change.dir, deps.clock.now());
    }
    deps.store.move(change.dir, target);
    removeMarker(deps.store, change.projectRoot, change.branch);
    rebuildChange(index, { id: change.id, dir: target, archived: true });

    const paths = [".bdk/specs", relativePath(change.projectRoot, change.dir), report.archivedTo];
    const files = await changedPaths(
      deps.git,
      change.projectRoot,
      paths.map((path) => `${path}/`),
    );
    const committed = await pathspecCommit(
      deps.git,
      change.projectRoot,
      files,
      `chore(bdk): close ${change.id}\n\nBDK-Change: ${change.id}`,
    );
    if (!committed.committed) {
      return refuse(
        "policy/git-hook-failed",
        `a git hook rejected the close commit of ${change.id}: ${committed.output}; the archive is in the work tree`,
        [
          "fix what the hook reports",
          `git add -A -- ${paths.join(" ")} && git commit -m "chore(bdk): close ${change.id}"`,
        ],
      );
    }
    return report;
  });
}

/** The refusals of `close` before the merge's own, in contract order. */
async function checks(
  deps: ChangeDeps,
  change: ActiveChange,
  index: IndexDb,
  globalDir: string,
): Promise<Refusal | undefined> {
  const gate = await gateRefusal(deps, change, index, globalDir, "gate:review");
  if (gate !== undefined) return gate;
  const tickets = openAttempts(index, change.id);
  if (tickets.length > 0) {
    const list = tickets.map((ticket) => ticket.ticket).join(", ");
    return refuse("policy/ticket-open", `${list} still open in ${change.id}`, [
      "bdk attempt close <ticket> <outcome>",
      "bdk change takeover --close-tickets",
    ]);
  }
  const undecided = listEntries(index, change.id).filter(
    (entry) =>
      DECIDED_TYPES.has(entry.type) &&
      !DONE.has(entry.status) &&
      (entry.disposition === undefined || entry.disposition === "fix"),
  );
  if (undecided.length > 0) {
    const list = undecided
      .map(
        (entry) =>
          `${entry.id} (${entry.disposition === "fix" ? "fix not made" : "no disposition"})`,
      )
      .join(", ");
    return refuse("policy/undecided-entries", `${list} in ${change.id} need a decision`, [
      "/bdk:cr --report",
      "bdk log decide <id> fix|defer|reject|track",
    ]);
  }
  const progress = await taskProgress(
    deps.git,
    change.projectRoot,
    change.id,
    readPlanParts(deps.store, change.dir),
    readAttempts(deps.store, change.dir),
  );
  if (progress.mismatches.length > 0) {
    return refuse("state/trailer-mismatch", progress.mismatches.join("; "), [
      "fix the trailer or the plan part named, then run bdk rebuild",
    ]);
  }
  return gitInProgress(change.projectRoot);
}

function closeReport(
  change: ActiveChange,
  index: IndexDb,
  plan: MergePlan,
  archivedTo: string,
): CloseReport {
  const entries = listEntries(index, change.id);
  const merged = plan.report.merged.map((item) => item.capability);
  const live = entries.filter((entry) => !DONE.has(entry.status));
  return {
    change: change.id,
    archivedTo,
    spec: { merged, unchanged: merged.length === 0 },
    gatesByPolicy: gatesByPolicy(entries),
    summary: closeSummary(findChangeRow(index, change.id)?.intent ?? change.id, live, merged),
  };
}

function gatesByPolicy(entries: readonly EntryRow[]): string[] {
  const gates = entries
    .filter((entry) => entry.type === "transition" && entry.source === "policy")
    .flatMap((entry) => (entry.gate === undefined ? [] : [entry.gate]));
  return [...new Set(gates)].sort();
}

function relativePath(projectRoot: string, path: string): string {
  return relative(projectRoot, path).split(sep).join("/");
}

// `bdk part done <part>` (`kernel-cli/part`; T22 design D-8): the part is
// started, every task has a trailer commit reachable from `HEAD`, no ticket
// of the part is open, and trailers agree with the plan. The done marker then
// carries the hash of the part file, so a later edit makes the node stale.
import { checksOf, readGraph, writeDoneMarker } from "../../graph/index.ts";
import { withChangeIndex } from "../../log/index.ts";
import { refuse } from "../../shared/refusal/index.ts";
import type { Refusal } from "../../shared/refusal/index.ts";
import type { ActiveChange } from "../../shared/registry/index.ts";
import {
  checkpointChange,
  partWorktree,
  readAttempts,
  refreshChange,
  taskProgress,
} from "../../shared/store/index.ts";
import type { EntryRow, PlanPartFile } from "../../shared/store/index.ts";
import type { PartDoneReport } from "../domain/reports.ts";
import type { PartDeps } from "./deps.ts";
import { partsWith } from "./parts.ts";
import { tinyGuard } from "./tiny.ts";
import { mergeBack } from "./worktree.ts";

export function donePart(
  deps: PartDeps,
  change: ActiveChange,
  globalDir: string,
  id: string,
): Promise<PartDoneReport | Refusal> {
  return withChangeIndex(deps, change, async (index) => {
    const found = partsWith(deps.store, change.dir, id);
    if ("refused" in found) return found;
    const { parts, part } = found;
    const read = await readGraph(deps, change, index, globalDir, { work: true });
    if ("refused" in read) return read;
    const node = read.graph.find(`execute-part:${id}`);
    if (node === undefined) {
      return refuse(
        "policy/invalid-transition",
        `execute-part:${id} is not part of this Change's graph`,
        ["bdk part list"],
      );
    }
    if (node.state === "done") {
      return refuse("policy/invalid-transition", `part ${id} is already done and unchanged`, [
        "bdk next",
      ]);
    }
    const checks = checksOf(read, node);
    const started = checks.find((check) => check.id === "started");
    if (started?.ok === false) {
      return refuse("policy/invalid-transition", `part ${id} is not started`, [
        `bdk part start ${id}`,
      ]);
    }
    const progress = await taskProgress(
      deps.git,
      change.projectRoot,
      change.id,
      parts,
      readAttempts(deps.store, change.dir),
    );
    if (progress.mismatches.length > 0) {
      return refuse("state/trailer-mismatch", progress.mismatches.join("; "), [
        "fix the plan part or amend the commit trailers, then bdk rebuild",
      ]);
    }
    const tickets = checks.find((check) => check.id === "tickets");
    if (tickets?.ok === false) {
      return refuse("policy/ticket-open", tickets.why ?? `a ticket of part ${id} is open`, [
        "bdk attempt close <ticket> <outcome>",
        "bdk attempt list",
      ]);
    }
    const failed = checks.find((check) => !check.ok);
    if (failed !== undefined) {
      return refuse(
        "policy/validation-failed",
        `execute-part:${id} fails check ${failed.id}: ${failed.why ?? "failed"}`,
        [
          ...(failed.instead === undefined ? [] : [failed.instead]),
          `bdk validate execute-part:${id}`,
        ],
      );
    }

    const workdir = await partWorktree(deps.git, deps.store, change, id);
    const merged =
      workdir === undefined ? undefined : await mergeBack(deps, change, index, part, workdir);
    if (merged !== undefined && "refused" in merged) return merged;
    const written = await writeDoneMarker(deps, change, index, read, node);
    if ("refused" in written) return written;
    // The part's agents commit code only: the part's records reach git here (#166).
    const checkpoint = await checkpointChange({
      store: deps.store,
      git: deps.git,
      projectRoot: change.projectRoot,
      change,
      settings: read.resolved.value,
    });
    if (read.view.profile === "tiny") await tinyGuard(deps, change, index);
    refreshChange(index, { id: change.id, dir: change.dir, archived: false });
    const after = await readGraph(deps, change, index, globalDir);
    if ("refused" in after) return after;
    const next = after.parked === undefined ? after.graph.next?.id : undefined;
    return {
      part: id,
      state: "done",
      commits: part.tasks.map((task) => ({
        task: task.id,
        commit: (progress.committed.get(task.id) ?? "").slice(0, 7),
      })),
      openFindings: openFindings(after.entries, part),
      entry: written.entry.id,
      ...(next === undefined ? {} : { next }),
      ...(merged === undefined ? {} : { merge: merged.merge, discarded: merged.discarded }),
      ...(checkpoint.done ? { checkpoint: checkpoint.commit.slice(0, 7) } : {}),
    };
  });
}

/** Live `finding` entries naming the part, its file or one of its tasks; they never block. */
function openFindings(entries: readonly EntryRow[], part: PlanPartFile): string[] {
  const names = new Set([
    part.id,
    `execute-part:${part.id}`,
    part.file,
    ...part.tasks.map((task) => task.id),
  ]);
  return entries
    .filter(
      (entry) =>
        entry.type === "finding" &&
        (entry.status === "proposed" || entry.status === "accepted") &&
        entry.refs.some((ref) => names.has(ref)),
    )
    .map((entry) => entry.id);
}

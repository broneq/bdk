// `bdk part start <part>` (`kernel-cli/part`; T22 design D-8): the part must
// pass the plan part checks and be ready; the kernel then writes the start
// marker, a transition without `input-hash` that moves the stage to `execute`
// and never marks the node done.
import { checksOf, readGraph } from "../../graph/index.ts";
import { appendEntry, withChangeIndex } from "../../log/index.ts";
import { refuse } from "../../shared/refusal/index.ts";
import type { Refusal, Rule } from "../../shared/refusal/index.ts";
import { removeWorktree } from "../../shared/git/index.ts";
import type { ActiveChange } from "../../shared/registry/index.ts";
import { isolationOf } from "../../shared/store/index.ts";
import type { PartStartReport } from "../domain/reports.ts";
import type { PartDeps } from "./deps.ts";
import { partState } from "./list.ts";
import { partsWith } from "./parts.ts";
import { createWorktree, startMarkerBody, worktreeSettings } from "./worktree.ts";

export function startPart(
  deps: PartDeps,
  change: ActiveChange,
  globalDir: string,
  id: string,
): Promise<PartStartReport | Refusal> {
  return withChangeIndex(deps, change, async (index) => {
    const found = partsWith(deps.store, change.dir, id);
    if ("refused" in found) return found;
    const { part } = found;
    const read = await readGraph(deps, change, index, globalDir);
    if ("refused" in read) return read;
    const planned = read.graph.find(`plan-part:${id}`);
    const failed =
      planned === undefined ? undefined : checksOf(read, planned).find((check) => !check.ok);
    if (failed !== undefined) {
      return refuse(
        (failed.rule ?? "policy/validation-failed") as Rule,
        `plan-part:${id} fails check ${failed.id}: ${failed.why ?? "failed"}`,
        [...(failed.instead === undefined ? [] : [failed.instead]), `bdk validate plan-part:${id}`],
      );
    }
    const node = read.graph.find(`execute-part:${id}`);
    const state = partState(read, id);
    if (node === undefined || state === "blocked") {
      return refuse(
        "policy/not-ready",
        `execute-part:${id} is blocked: ${node?.why ?? "it is not part of this Change's graph"}`,
        [`bdk explain execute-part:${id}`, "bdk next"],
      );
    }
    if (state === "started" || state === "done") {
      return refuse(
        "policy/invalid-transition",
        `part ${id} is already ${state}`,
        state === "done" ? ["bdk part list", "bdk next"] : [`bdk part done ${id}`],
      );
    }
    const worktree = isolationOf(part.data) === "worktree";
    const settings = worktreeSettings(read.resolved.value);
    const created =
      worktree && settings.enabled ? await createWorktree(deps, change, id, settings) : undefined;
    if (created !== undefined && "refused" in created) return created;
    const written = await appendEntry(
      deps,
      change,
      index,
      {
        type: "transition",
        summary: `part ${id} started`,
        status: "accepted",
        refs: [`execute-part:${id}`, part.file],
        body: created === undefined ? "" : startMarkerBody(created),
        to: `execute-part:${id}`,
      },
      { dedupe: false },
    );
    if ("refused" in written) {
      if (created !== undefined) {
        await removeWorktree(deps.git, change.projectRoot, created.workdir, created.branch);
      }
      return written;
    }
    return {
      part: id,
      state: "started",
      tasks: part.tasks.map((task) => ({
        task: task.id,
        files: task.files.map((file) => file.path),
        ...(task.stopRule === undefined ? {} : { stopRule: task.stopRule }),
        ...(task.verification === undefined ? {} : { verification: task.verification }),
      })),
      doNotTouch: part.data["do-not-touch"],
      successMeasure: part.data["success-measure"],
      entry: written.entry.id,
      isolation: created === undefined ? "shared" : "worktree",
      ...(created === undefined ? {} : { workdir: created.workdir }),
      ...(created?.setup === undefined
        ? {}
        : {
            setup: {
              command: created.setup.command,
              exitCode: created.setup.exitCode,
              durationMs: created.setup.durationMs,
            },
          }),
      ...(worktree && !settings.enabled ? { downgraded: true } : {}),
    };
  });
}

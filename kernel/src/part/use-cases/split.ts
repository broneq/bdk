// `bdk part split <part> <task-ids>` (`kernel-cli/part`; T22 design D-12):
// the one command that edits plan files after `plan` is done. Moved tasks
// keep their ids, so their attempt records and budgets carry over; the edited
// parts change their hashes, so the plan parts and `plan-verify` turn stale.
import { join } from "node:path";

import { readGraph } from "../../graph/index.ts";
import { appendEntry, withChangeIndex } from "../../log/index.ts";
import { refuse } from "../../shared/refusal/index.ts";
import type { Refusal } from "../../shared/refusal/index.ts";
import type { ActiveChange } from "../../shared/registry/index.ts";
import {
  generatePlanIndex,
  openAttempts,
  readDocument,
  taskProgress,
  writeDocument,
} from "../../shared/store/index.ts";
import type { PlanPartFile } from "../../shared/store/index.ts";
import type { PartSplitReport } from "../domain/reports.ts";
import { slugOf, splitBody } from "../domain/split.ts";
import type { PartDeps } from "./deps.ts";
import { partsWith } from "./parts.ts";

export function splitPart(
  deps: PartDeps,
  change: ActiveChange,
  globalDir: string,
  id: string,
  taskIds: string,
): Promise<PartSplitReport | Refusal> {
  return withChangeIndex(deps, change, async (index) => {
    const found = partsWith(deps.store, change.dir, id);
    if ("refused" in found) return found;
    const { parts, part } = found;
    const moved = [...new Set(taskIds.split(",").map((task) => task.trim()))].filter(
      (task) => task !== "",
    );
    const held = new Set(part.tasks.map((task) => task.id));
    const stranger = moved.find((task) => !held.has(task));
    if (moved.length === 0 || stranger !== undefined) {
      return refuse(
        "input/invalid-argument",
        stranger === undefined
          ? "<task-ids> names no task"
          : `part ${id} holds no task ${stranger}; it holds ${[...held].join(", ")}`,
        [`bdk part split ${id} ${[...held].slice(-1).join(",")}`],
      );
    }
    if (moved.length === held.size) {
      return refuse(
        "input/invalid-argument",
        `moving every task of part ${id} leaves it empty; keep at least one`,
        [`bdk part split ${id} ${[...held].slice(1).join(",")}`],
      );
    }
    const read = await readGraph(deps, change, index, globalDir);
    if ("refused" in read) return read;
    if (read.graph.find(`execute-part:${id}`)?.state === "done") {
      return refuse("policy/invalid-transition", `part ${id} is done; a done part is not split`, [
        "bdk part list",
      ]);
    }
    const { committed } = await taskProgress(deps.git, change.projectRoot, change.id, parts, []);
    const done = moved.find((task) => committed.has(task));
    if (done !== undefined) {
      return refuse(
        "policy/invalid-transition",
        `task ${done} has commit ${(committed.get(done) ?? "").slice(0, 7)}; a committed task stays in its part`,
        [`bdk part split ${id} ${moved.filter((task) => task !== done).join(",") || "<task-ids>"}`],
      );
    }
    const owned = new Set([id, ...moved]);
    const open = openAttempts(index, change.id).find((ticket) => owned.has(ticket.target));
    if (open !== undefined) {
      return refuse("policy/ticket-open", `ticket ${open.ticket} is open on ${open.target}`, [
        `bdk attempt close ${open.ticket} <outcome>`,
      ]);
    }

    const newPart = nextId(parts);
    const body = splitBody(part.body, new Set(moved));
    const first = part.tasks.find((task) => task.id === moved[0]);
    const file = `plan/parts/${newPart}-${slugOf(first?.title ?? part.data.title)}.md`;
    const original = frontmatterOf(deps, part);
    writeDocument(deps.store, join(change.dir, file), {
      data: { ...original, id: newPart, title: `${part.data.title} (split from ${id})` },
      body: body.moved,
    });
    writeDocument(deps.store, part.path, { data: original, body: body.kept });
    const rows = parts.map((each) => ({
      id: each.id,
      title: each.data.title,
      "depends-on": [...each.data["depends-on"]],
    }));
    for (const dependent of parts) {
      if (!dependent.data["depends-on"].includes(id)) continue;
      const data = frontmatterOf(deps, dependent);
      const dependsOn = [...dependent.data["depends-on"], newPart];
      writeDocument(deps.store, dependent.path, {
        data: { ...data, "depends-on": dependsOn },
        body: dependent.body,
      });
      const row = rows.find((each) => each.id === dependent.id);
      if (row !== undefined) row["depends-on"] = dependsOn;
    }
    rows.push({
      id: newPart,
      title: `${part.data.title} (split from ${id})`,
      "depends-on": [...part.data["depends-on"]],
    });
    deps.store.write(join(change.dir, "plan/index.md"), generatePlanIndex(rows));

    const written = await appendEntry(
      deps,
      change,
      index,
      {
        type: "decision",
        summary: `Part ${id} split: ${moved.join(", ")} moved to part ${newPart}`,
        status: "accepted",
        refs: [part.file, file, ...moved],
        body: "",
      },
      { dedupe: false },
    );
    if ("refused" in written) return written;
    return { part: id, newPart, moved, entry: written.entry.id };
  });
}

/** The highest part id plus one, two digits. */
function nextId(parts: readonly PlanPartFile[]): string {
  const highest = Math.max(0, ...parts.map((part) => Number(part.id)));
  return String(highest + 1).padStart(2, "0");
}

/** The part's frontmatter as stored, every field kept. */
function frontmatterOf(deps: PartDeps, part: PlanPartFile): Record<string, unknown> {
  const document = readDocument(deps.store, part.path);
  return document !== undefined && "data" in document ? { ...document.data } : { ...part.data };
}

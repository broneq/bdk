// `bdk done <artifact>` (`kernel-cli/graph`; design D-3, D-8, D-10): the only
// writer of an artifact's done state. The node must be ready or stale and
// pass its validator; the kernel then records a `transition` with the hash of
// the node's inputs. Every check runs before the first write.
import { join } from "node:path";

import type { GraphNode } from "../domain/engine.ts";
import { partFiles } from "../domain/kinds/index.ts";
import type { Kind } from "../domain/kinds/index.ts";
import type { DoneReport } from "../domain/reports.ts";
import { appendEntry, withChangeIndex } from "../../log/index.ts";
import type { AppendResult } from "../../log/index.ts";
import { refuse } from "../../shared/refusal/index.ts";
import type { Refusal } from "../../shared/refusal/index.ts";
import type { ActiveChange } from "../../shared/registry/index.ts";
import { generateDesignIndex, generatePlanIndex, refreshChange } from "../../shared/store/index.ts";
import type { IndexDb } from "../../shared/store/index.ts";
import type { GraphDeps } from "./deps.ts";
import { notFound } from "./explain.ts";
import { readGraph } from "./graph.ts";
import type { ChangeGraph } from "./graph.ts";
import { inputHasher } from "./hash.ts";
import { checksOf } from "./validate.ts";

export function markDone(
  deps: GraphDeps,
  change: ActiveChange,
  globalDir: string,
  id: string,
): Promise<DoneReport | Refusal> {
  return withChangeIndex(deps, change, async (index) => {
    const read = await readGraph(deps, change, index, globalDir);
    if ("refused" in read) return read;
    const node = read.graph.find(id);
    if (node === undefined) return notFound(read, change, id);
    const kind = read.kinds.get(node.kind);
    if (kind === undefined) throw new Error(`${node.id} has the unknown kind ${node.kind}`);

    const refused = refusal(read, node, kind);
    if (refused !== undefined) return refused;
    if (isSplitDesign(read, kind)) return raiseToLarge(deps, change, index, globalDir, read, node);

    const targets =
      node.instances === undefined || node.instances.length === 0
        ? [node]
        : node.instances
            .map((instance) => read.graph.find(instance))
            .filter((instance) => instance?.state === "ready" || instance?.state === "stale")
            .filter((instance) => instance !== undefined);
    const hash = (await read.currentHash(node)) ?? emptyHash(deps, change);
    if (targets.length === 0 || (targets.length === 1 && targets[0]?.state === "done")) {
      if (node.state !== "done") {
        return refuse("policy/not-ready", `${node.id} has no ready part to mark`, [
          `bdk explain ${node.id}`,
        ]);
      }
      return {
        artifact: node.id,
        state: "done",
        inputHash: hash,
        next: nextOf(read),
        ...recorded(node),
      };
    }

    for (const target of targets) {
      const failed = checksOf(read, target).filter((check) => !check.ok);
      const first = failed[0];
      if (first !== undefined) {
        const named = failed.map((check) => `${check.id}: ${check.why ?? "failed"}`).join("; ");
        return refuse(
          "policy/validation-failed",
          `${target.id} fails ${failed.length === 1 ? "check" : "checks"} ${named}`,
          [...(first.instead === undefined ? [] : [first.instead]), `bdk validate ${target.id}`],
        );
      }
    }
    const generated = indexOf(read, kind, node, targets);

    let entry: string | undefined;
    for (const target of targets) {
      const written = await writeDoneMarker(deps, change, index, read, target);
      if ("refused" in written) return written;
      entry = written.entry.id;
    }
    if (generated !== undefined) deps.store.write(join(change.dir, generated.path), generated.text);

    const after = await reread(deps, change, index, globalDir);
    if ("refused" in after) return after;
    return {
      artifact: node.id,
      state: "done",
      inputHash: hash,
      next: nextOf(after),
      ...(entry === undefined ? {} : { entry }),
    };
  });
}

/**
 * The done marker of a node (`kernel-pipeline`, Node states): a kernel
 * `transition` to the node with the hash of its current inputs. `bdk done`
 * and `part done` are its only callers.
 */
export async function writeDoneMarker(
  deps: GraphDeps,
  change: ActiveChange,
  index: IndexDb,
  read: ChangeGraph,
  target: GraphNode,
): Promise<AppendResult | Refusal> {
  const kind = read.kinds.get(target.kind);
  if (kind === undefined) throw new Error(`${target.id} has the unknown kind ${target.kind}`);
  const inputHash = (await read.currentHash(target)) ?? emptyHash(deps, change);
  const files = kind.writes(read.view, target.nn).filter((path) => !path.includes("<"));
  return appendEntry(
    deps,
    change,
    index,
    {
      type: "transition",
      summary: `${target.id} done`,
      status: "accepted",
      refs: [target.id, ...files],
      body: "",
      to: target.id,
      inputHash,
    },
    { dedupe: false },
  );
}

/** The refusals that depend only on the node and its kind. */
function refusal(read: ChangeGraph, node: GraphNode, kind: Kind): Refusal | undefined {
  const { doneBy } = kind;
  if (node.state === "skipped" && !isSplitDesign(read, kind)) {
    return refuse(
      "policy/invalid-transition",
      `${node.id} is not part of this Change's graph: ${node.why ?? "skipped"}`,
      ["bdk next", `bdk explain ${node.id}`],
    );
  }
  if (doneBy.through === "gate") {
    return refuse(
      "policy/gate-not-ready",
      `${node.id} is passed only by a user (or policy) transition, never by bdk done`,
      [node.gate?.command ?? "type the next stage command", `bdk explain ${node.id}`],
    );
  }
  if (doneBy.through === "construction") {
    return refuse("policy/invalid-transition", `${node.id} is done by construction at change new`, [
      "bdk next",
    ]);
  }
  if (doneBy.through === "command") {
    const command = doneBy.command.replaceAll("{nn}", node.nn ?? "<nn>");
    return refuse(
      "policy/invalid-transition",
      `${node.id} is completed by ${command}, not bdk done`,
      [command],
    );
  }
  if (node.state === "blocked") {
    const open = node.requires.find((id) => read.graph.find(id)?.state !== "done");
    return refuse("policy/not-ready", `${node.id}: ${node.why ?? "a requirement is not done"}`, [
      `bdk explain ${node.id}`,
      ...(open === undefined ? [] : [`bdk done ${open}`]),
    ]);
  }
  return undefined;
}

/** Design D-8: a `small` Change whose design is split into parts, without `design.md`. */
function isSplitDesign(read: ChangeGraph, kind: Kind): boolean {
  return (
    kind.name === "design" &&
    read.view.profile === "small" &&
    read.view.file("design.md") === undefined &&
    partFiles(read.view, "design/parts").size > 0
  );
}

async function raiseToLarge(
  deps: GraphDeps,
  change: ActiveChange,
  index: IndexDb,
  globalDir: string,
  read: ChangeGraph,
  node: GraphNode,
): Promise<DoneReport | Refusal> {
  const parts = [...partFiles(read.view, "design/parts").values()];
  const written = await appendEntry(
    deps,
    change,
    index,
    {
      type: "decision",
      summary: "Profile raised to large: the design is split into design/parts/",
      status: "accepted",
      refs: ["design/parts/"],
      body: "",
      profile: "large",
    },
    { dedupe: false },
  );
  if ("refused" in written) return written;
  const after = await reread(deps, change, index, globalDir);
  if ("refused" in after) return after;
  return {
    artifact: node.id,
    state: "done",
    inputHash: inputHasher(deps.store, change.dir, undefined)({ files: parts }),
    next: nextOf(after),
    entry: written.entry.id,
  };
}

/** The generated index this call completes, rendered before any write so a bad part refuses first. */
function indexOf(
  read: ChangeGraph,
  kind: Kind,
  node: GraphNode,
  targets: readonly GraphNode[],
): { readonly path: string; readonly text: string } | undefined {
  if (kind.name === "design-index") {
    return { path: "design/index.md", text: generateDesignIndex(partsOf(read, "design/parts")) };
  }
  if (kind.name !== "plan-part") return undefined;
  const collection = node.instances === undefined ? read.graph.find(node.node.id) : node;
  const marked = new Set(targets.map((target) => target.id));
  const complete = (collection?.instances ?? []).every(
    (id) => marked.has(id) || read.graph.find(id)?.state === "done",
  );
  return complete
    ? { path: "plan/index.md", text: generatePlanIndex(partsOf(read, "plan/parts")) }
    : undefined;
}

function partsOf(
  read: ChangeGraph,
  dir: string,
): { id: string; title: string; "depends-on": string[] }[] {
  return [...partFiles(read.view, dir).values()].map((path) => {
    const data = read.view.file(path)?.data ?? {};
    const dependsOn = data["depends-on"];
    return {
      id: String(data.id),
      title: String(data.title),
      "depends-on": Array.isArray(dependsOn) ? dependsOn.map(String) : [],
    };
  });
}

async function reread(
  deps: GraphDeps,
  change: ActiveChange,
  index: IndexDb,
  globalDir: string,
): Promise<ChangeGraph | Refusal> {
  refreshChange(index, { id: change.id, dir: change.dir, archived: false });
  return readGraph(deps, change, index, globalDir);
}

/** What `next` returns now: an artifact id, the gate waited for, or what else the Change waits for. */
function nextOf(read: ChangeGraph): string {
  if (read.parked !== undefined) return "user";
  return read.graph.next?.id ?? read.graph.waitingGate?.gate ?? "nothing";
}

function recorded(node: GraphNode): { entry?: string } {
  return node.recorded === undefined ? {} : { entry: node.recorded.id };
}

function emptyHash(deps: GraphDeps, change: ActiveChange): string {
  return inputHasher(deps.store, change.dir, undefined)({ files: [] });
}

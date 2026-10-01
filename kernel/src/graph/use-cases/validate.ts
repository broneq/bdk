// `bdk validate [<artifact>]` (`kernel-cli/graph`): the kind's validator on
// the node's current files, with the current input hash. Never writes.
import type { GraphNode } from "../domain/engine.ts";
import type { Check } from "../domain/kinds/index.ts";
import type { ValidateReport } from "../domain/reports.ts";
import { withChangeIndex } from "../../log/index.ts";
import { refuse } from "../../shared/refusal/index.ts";
import type { Refusal } from "../../shared/refusal/index.ts";
import type { ActiveChange } from "../../shared/registry/index.ts";
import type { GraphDeps } from "./deps.ts";
import { readGraph } from "./graph.ts";
import type { ChangeGraph } from "./graph.ts";
import { notFound } from "./explain.ts";

export function validateNode(
  deps: GraphDeps,
  change: ActiveChange,
  globalDir: string,
  id: string | undefined,
): Promise<ValidateReport | Refusal> {
  return withChangeIndex(deps, change, async (index) => {
    const read = await readGraph(deps, change, index, globalDir, { work: true });
    if ("refused" in read) return read;
    const node = id === undefined ? read.graph.next : read.graph.find(id);
    if (node === undefined) {
      return id === undefined ? nothingActionable(read, change) : notFound(read, change, id);
    }
    const checks = checksOf(read, node);
    const inputHash = await read.currentHash(node);
    return {
      artifact: node.id,
      valid: checks.every((check) => check.ok),
      ...(inputHash === undefined ? {} : { inputHash }),
      checks,
    };
  });
}

/** Every check of the node's validator; a collection's are its instances', prefixed by their ids. */
export function checksOf(read: ChangeGraph, node: GraphNode): Check[] {
  const kind = read.kinds.get(node.kind);
  if (kind === undefined) throw new Error(`${node.id} has the unknown kind ${node.kind}`);
  const instances = node.instances ?? [];
  if (instances.length === 0) {
    return kind.validate(read.view, {
      id: node.id,
      ...(node.nn === undefined ? {} : { nn: node.nn }),
      requires: node.requires,
    });
  }
  return instances.flatMap((instance) => {
    const found = read.graph.find(instance);
    const nn = found?.nn;
    return kind
      .validate(read.view, {
        id: instance,
        ...(nn === undefined ? {} : { nn }),
        requires: found?.requires ?? [],
      })
      .map((check) => ({ ...check, id: `${instance}:${check.id}` }));
  });
}

function nothingActionable(read: ChangeGraph, change: ActiveChange): Refusal {
  const gate = read.graph.waitingGate;
  const why =
    read.parked !== undefined
      ? `${change.id} is parked; no artifact is actionable`
      : gate !== undefined
        ? `${change.id} waits for ${gate.gate}; no artifact is actionable`
        : `every node of ${change.id} is done; no artifact is actionable`;
  return refuse("input/not-found", why, ["bdk validate <artifact>", "bdk next"]);
}

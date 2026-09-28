// A gate that a command other than the graph's own requires, such as
// `gate:review` before `spec merge` and `change close` (T30-D7, D11): done,
// or `policy/gate-not-ready` naming what the gate waits for.
import { withChangeIndex } from "../../log/index.ts";
import { refuse } from "../../shared/refusal/index.ts";
import type { Refusal } from "../../shared/refusal/index.ts";
import type { ActiveChange } from "../../shared/registry/index.ts";
import type { IndexDb } from "../../shared/store/index.ts";
import type { GraphDeps } from "./deps.ts";
import { readGraph } from "./graph.ts";

export async function gateRefusal(
  deps: GraphDeps,
  change: ActiveChange,
  index: IndexDb,
  globalDir: string,
  gate: string,
): Promise<Refusal | undefined> {
  const read = await readGraph(deps, change, index, globalDir);
  if ("refused" in read) return read;
  const node = read.graph.find(gate);
  if (node?.state === "done") return undefined;
  return refuse(
    "policy/gate-not-ready",
    `${gate} is not done: ${node?.why ?? "it is not part of this Change's graph"}`,
    [...(node?.gate?.command === undefined ? [] : [node.gate.command]), `bdk explain ${gate}`],
  );
}

/** `gateRefusal` with the Change's index opened and refreshed. */
export function requireGate(
  deps: GraphDeps,
  change: ActiveChange,
  globalDir: string,
  gate: string,
): Promise<Refusal | undefined> {
  return withChangeIndex(deps, change, (index) =>
    gateRefusal(deps, change, index, globalDir, gate),
  );
}

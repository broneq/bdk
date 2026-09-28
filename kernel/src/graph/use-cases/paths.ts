// The files an agent reads for an artifact target (T23-D37): what the node
// writes and hashes, and the same of the nodes it requires, so a
// `plan-verify` package names the plan parts it verifies.
import type { Refusal } from "../../shared/refusal/index.ts";
import type { ActiveChange } from "../../shared/registry/index.ts";
import type { IndexDb } from "../../shared/store/index.ts";
import type { GraphDeps } from "./deps.ts";
import { readGraph } from "./graph.ts";

/** Paths relative to the Change directory, in node order; undefined when the graph has no such node. */
export async function artifactPaths(
  deps: GraphDeps,
  change: ActiveChange,
  index: IndexDb,
  globalDir: string,
  target: string,
): Promise<readonly string[] | undefined | Refusal> {
  const read = await readGraph(deps, change, index, globalDir);
  if ("refused" in read) return read;
  const node = read.graph.nodes.find((found) => found.id === target);
  if (node === undefined) return undefined;
  const paths = new Set<string>();
  for (const id of [node.id, ...node.requires]) {
    const found = read.graph.nodes.find((candidate) => candidate.id === id);
    const kind = found === undefined ? undefined : read.kinds.get(found.kind);
    if (found === undefined || kind === undefined) continue;
    const inputs = kind.inputs(read.view, found.nn);
    const files = [...kind.writes(read.view, found.nn), ...("files" in inputs ? inputs.files : [])];
    for (const path of files) if (!path.includes("<")) paths.add(path);
  }
  return [...paths];
}

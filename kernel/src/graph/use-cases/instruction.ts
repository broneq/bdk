// Gathers what the instruction of a node needs (design D-9): the resolved
// template `pipeline/<kind>`, the pack's rules by id through `ctx`, and the ledger
// entries that concern the node, newest first.
import { posix, relative, sep } from "node:path";

import type { GraphNode } from "../domain/engine.ts";
import { composeInstruction } from "../domain/instruction.ts";
import { live } from "../domain/kinds/index.ts";
import type { GraphEntry } from "../domain/kinds/index.ts";
import { pipelinePrompts } from "../config.ts";
import { categoryText } from "../../ctx/index.ts";
import { promptContent } from "../../shared/config/index.ts";
import type { ActiveChange } from "../../shared/registry/index.ts";
import type { GraphDeps } from "./deps.ts";
import type { ChangeGraph } from "./graph.ts";

export function instructionOf(
  deps: GraphDeps,
  change: ActiveChange,
  read: ChangeGraph,
  node: GraphNode,
): string {
  const kind = read.kinds.get(node.kind);
  if (kind === undefined) throw new Error(`${node.id} has the unknown kind ${node.kind}`);
  const key = templateKey(deps, node.kind);
  const value = read.resolved.prompts.values.get(key);
  if (value === undefined) throw new Error(`the prompt value ${key} has no file in any layer`);
  const dir = relative(change.projectRoot, change.dir).split(sep).join("/");
  const writes = kind.writes(read.view, node.nn);
  return composeInstruction({
    node,
    kind,
    change: change.id,
    profile: read.view.profile,
    template: promptContent(deps.store, value),
    paths: writes.map((path) => posix.join(dir, path)),
    rules: (node.node.rules ?? []).map((category) => ({
      category,
      text: categoryText(
        { store: deps.store, pluginRoot: deps.pluginRoot, projectRoot: change.projectRoot },
        read.resolved,
        category,
      ),
    })),
    ledger: ledgerOf(read.view.entries, [node.id, ...writes]),
  });
}

/** Accepted decisions, live questions and blockers, and live review entries naming the node. */
function ledgerOf(entries: readonly GraphEntry[], names: readonly string[]): GraphEntry[] {
  return entries
    .filter(
      (entry) =>
        (entry.type === "decision" && entry.status === "accepted") ||
        ((entry.type === "question" || entry.type === "blocker") && live(entry)) ||
        (entry.review && live(entry) && entry.refs.some((ref) => names.includes(ref))),
    )
    .reverse();
}

/** A shipped kind's key from `pipelinePrompts`, an added kind's from the settings registry. */
function templateKey(deps: GraphDeps, kind: string): string {
  const key = `pipeline/${kind}`;
  const declared =
    pipelinePrompts.some((prompt) => prompt.key === key) ||
    deps.settings.promptKey(key) !== undefined;
  if (!declared) throw new Error(`${key} is not a declared prompt key`);
  return key;
}

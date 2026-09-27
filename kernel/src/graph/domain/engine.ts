// The state engine (`kernel-pipeline`, Node states; design D-3, D-5, D-7):
// every node's state derived from the Change files and the ledger on each
// read, never stored. Hashing is injected, so this stays pure; it is asked
// only for nodes with a recorded done entry.
import { gateStatus } from "./gate.ts";
import type { GatePolicy, GateStatus } from "./gate.ts";
import type { ChangeView, GraphEntry, Inputs, Kind, KindRegistry } from "./kinds/index.ts";
import { GATE_KIND, stageCommand } from "./pipeline.ts";
import type { Pipeline, PipelineNode } from "./pipeline.ts";
import type { NodeState } from "../../shared/vocabulary/index.ts";

export interface GraphInput {
  readonly pipeline: Pipeline;
  readonly kinds: KindRegistry;
  readonly view: ChangeView;
  /** Resolved `features` switches. */
  readonly features: Readonly<Record<string, unknown>>;
  /** Resolved `policy.gates`. */
  readonly gates: Readonly<Record<string, GatePolicy>>;
  /** The `sha256:` hash of the inputs; never called with `none`. */
  readonly hash: (inputs: Inputs) => string;
}

export interface GraphNode {
  readonly id: string;
  readonly kind: string;
  readonly stage: string;
  /** The pipeline node; an instance carries its collection's. */
  readonly node: PipelineNode;
  /** Pipeline position, for ordering. */
  readonly position: number;
  /** Set on an instance: its two-digit number. */
  readonly nn?: string;
  /** Set on a collection node: its instance ids, in id order. */
  readonly instances?: readonly string[];
  readonly state: NodeState;
  /** Requirement ids after expansion: skipped ones dropped, collections replaced by their instances. */
  readonly requires: readonly string[];
  /** The current hash, computed when a done entry exists to compare with. */
  readonly inputHash?: string;
  /** The latest `transition` with `to: <id>` and `source: kernel`. */
  readonly recorded?: GraphEntry;
  readonly why?: string;
  /** A done gate transitively requires it. */
  readonly sealed: boolean;
  readonly gate?: GateStatus;
}

export interface Graph {
  /** In pipeline order; a collection's instances follow it. */
  readonly nodes: readonly GraphNode[];
  readonly gates: readonly GateStatus[];
  /** What `next` returns: the first actionable node that is ready or stale and not sealed. */
  readonly next?: GraphNode;
  /** Without `next`: the first gate that is ready and not done. */
  readonly waitingGate?: GateStatus;
  readonly find: (id: string) => GraphNode | undefined;
}

interface Draft {
  readonly id: string;
  readonly kind: Kind;
  readonly node: PipelineNode;
  readonly position: number;
  readonly nn?: string;
  readonly skipped?: string;
  /** Own requirements on top of the node's `requires` (instances only). */
  readonly extra: readonly string[];
  instances?: string[];
}

export function evaluate(input: GraphInput): Graph {
  const { pipeline, kinds, view } = input;
  const drafts = new Map<string, Draft>();
  const order: string[] = [];
  pipeline.nodes.forEach((node, position) => {
    const kind = kinds.get(node.kind);
    if (kind === undefined)
      throw new Error(`pipeline node ${node.id} has the unknown kind ${node.kind}`);
    const skipped = skipReason(node, kind, input);
    const draft: Draft = {
      id: node.id,
      kind,
      node,
      position,
      extra: [],
      ...(skipped === undefined ? {} : { skipped }),
    };
    drafts.set(node.id, draft);
    order.push(node.id);
    if (skipped !== undefined || kind.instances === undefined) return;
    draft.instances = [];
    for (const instance of kind.instances(view)) {
      const id = `${kind.name}:${instance.nn}`;
      draft.instances.push(id);
      drafts.set(id, { id, kind, node, position, nn: instance.nn, extra: instance.requires });
      order.push(id);
    }
  });

  const done = latestDone(view.entries);
  const results = new Map<string, GraphNode>();

  const expand = (ids: readonly string[]): string[] =>
    ids.flatMap((id) => {
      const draft = drafts.get(id);
      if (draft?.skipped !== undefined) return [];
      return draft?.instances !== undefined && draft.instances.length > 0 ? draft.instances : [id];
    });

  const resolve = (id: string): GraphNode | undefined => {
    const known = results.get(id);
    if (known !== undefined) return known;
    const draft = drafts.get(id);
    if (draft === undefined) return undefined;
    const result = compute(draft);
    results.set(id, result);
    return result;
  };

  /** The first requirement that is not done, with its state, or undefined when all are. */
  const firstOpen = (requires: readonly string[]): string | undefined => {
    for (const id of requires) {
      const required = resolve(id);
      if (required === undefined) return `${id} does not exist`;
      if (required.state !== "done") return `${id} is ${required.state}, not done`;
    }
    return undefined;
  };

  const compute = (draft: Draft): GraphNode => {
    const base = {
      id: draft.id,
      kind: draft.kind.name,
      stage: draft.node.stage,
      node: draft.node,
      position: draft.position,
      sealed: false,
      ...(draft.nn === undefined ? {} : { nn: draft.nn }),
      ...(draft.instances === undefined ? {} : { instances: draft.instances }),
    };
    if (draft.skipped !== undefined) {
      return { ...base, state: "skipped", requires: [], why: draft.skipped };
    }
    const requires = [...expand(draft.node.requires ?? []), ...draft.extra];
    const open = firstOpen(requires);

    if (draft.kind.doneBy.through === "gate") {
      const gate = gateOf(draft, requires, open === undefined);
      return {
        ...base,
        requires,
        state: gate.done ? "done" : gate.ready ? "ready" : "blocked",
        why: gate.done || gate.ready ? gate.why : (open ?? gate.why),
        gate,
      };
    }
    if (draft.instances !== undefined && draft.instances.length > 0) {
      const pending = firstOpen(draft.instances);
      if (pending === undefined) return { ...base, requires, state: "done" };
      return open === undefined
        ? { ...base, requires, state: "ready", why: pending }
        : { ...base, requires, state: "blocked", why: open };
    }
    if (draft.kind.doneBy.through === "construction") return { ...base, requires, state: "done" };

    const recorded = draft.instances === undefined ? done.get(draft.id) : undefined;
    if (recorded !== undefined) {
      const inputs = draft.kind.inputs(view, draft.nn);
      if ("none" in inputs) return { ...base, requires, recorded, state: "done" };
      const inputHash = input.hash(inputs);
      return recorded.inputHash === inputHash
        ? { ...base, requires, recorded, inputHash, state: "done" }
        : {
            ...base,
            requires,
            recorded,
            inputHash,
            state: "stale",
            why: `inputs changed: recorded ${recorded.inputHash ?? "none"}, current ${inputHash}`,
          };
    }
    return open === undefined
      ? { ...base, requires, state: "ready" }
      : { ...base, requires, state: "blocked", why: open };
  };

  const gateOf = (draft: Draft, requires: readonly string[], satisfied: boolean): GateStatus => {
    let readyAt: string | undefined;
    let incomplete = false;
    for (const id of requires) {
      const required = resolve(id);
      const at =
        required?.gate?.passedIn?.at ??
        required?.recorded?.at ??
        (required?.kind !== undefined && kinds.get(required.kind)?.doneBy.through === "construction"
          ? ""
          : undefined);
      if (at === undefined) incomplete = true;
      else if (at !== "" && (readyAt === undefined || at > readyAt)) readyAt = at;
    }
    const policy = draft.node.policy === undefined ? undefined : input.gates[draft.node.policy];
    const command =
      draft.node.opens === undefined ? undefined : stageCommand(pipeline, draft.node.opens);
    return gateStatus({
      id: draft.id,
      readyAt,
      incomplete,
      satisfied,
      policy: policy ?? "manual",
      command,
      entries: view.entries,
    });
  };

  for (const id of order) resolve(id);
  const sealed = sealedIds(order, results);
  const nodes = order.flatMap((id) => {
    const result = results.get(id);
    if (result === undefined) return [];
    return [sealed.has(id) ? { ...result, sealed: true } : result];
  });
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const gates = nodes.flatMap((node) =>
    node.gate === undefined || node.state === "skipped" ? [] : [node.gate],
  );
  const next = nodes.find(
    (node) =>
      (node.state === "ready" || node.state === "stale") &&
      !node.sealed &&
      node.kind !== GATE_KIND &&
      !(node.instances !== undefined && node.instances.length > 0),
  );
  const waitingGate =
    next === undefined
      ? nodes.find((node) => node.gate?.ready === true && !node.gate.done && !node.sealed)?.gate
      : undefined;
  return {
    nodes,
    gates,
    ...(next === undefined ? {} : { next }),
    ...(waitingGate === undefined ? {} : { waitingGate }),
    find: (id) => byId.get(id),
  };
}

function skipReason(node: PipelineNode, kind: Kind, input: GraphInput): string | undefined {
  const { profile, kind: changeKind } = input.view;
  if (node.profiles !== undefined && !node.profiles.includes(profile)) {
    return `profile ${profile} is not in profiles [${node.profiles.join(", ")}]`;
  }
  if (node.kinds !== undefined && !(node.kinds as readonly string[]).includes(changeKind)) {
    return `Change kind ${changeKind} is not in kinds [${node.kinds.join(", ")}]`;
  }
  if (node.if !== undefined) {
    const name = node.if.slice("features.".length);
    if (input.features[name] !== true) return `${node.if} is false`;
  }
  return kind.skip?.(input.view);
}

/** Node id -> the latest `transition` from the kernel naming it in `to`. */
function latestDone(entries: readonly GraphEntry[]): Map<string, GraphEntry> {
  const latest = new Map<string, GraphEntry>();
  for (const entry of entries) {
    if (entry.type !== "transition" || entry.source !== "kernel" || entry.to === undefined)
      continue;
    const known = latest.get(entry.to);
    if (
      known === undefined ||
      entry.at > known.at ||
      (entry.at === known.at && entry.id > known.id)
    ) {
      latest.set(entry.to, entry);
    }
  }
  return latest;
}

/** Every id a done gate transitively requires, collections with their instances. */
function sealedIds(order: readonly string[], results: ReadonlyMap<string, GraphNode>): Set<string> {
  const sealed = new Set<string>();
  const visit = (id: string): void => {
    const node = results.get(id);
    if (node === undefined) return;
    for (const required of [...node.requires, ...(node.instances ?? [])]) {
      if (sealed.has(required)) continue;
      sealed.add(required);
      visit(required);
    }
  };
  for (const id of order) {
    if (results.get(id)?.gate?.done === true) visit(id);
  }
  return sealed;
}

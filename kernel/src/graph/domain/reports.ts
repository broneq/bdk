// The answers of `next`, `explain`, `validate` and `done` (`kernel-cli/graph`)
// and the node and gate views `change status` shares.
import type { GraphNode } from "./engine.ts";
import type { GATE_PASSERS, NodeState } from "../../shared/vocabulary/index.ts";
import type { GateStatus } from "./gate.ts";
import type { Check } from "./kinds/index.ts";
import type { WaveItem } from "./wave.ts";

export const WAITING = ["gate", "user", "nothing"] as const;

type Waiting = (typeof WAITING)[number];

export interface NodeView {
  readonly id: string;
  readonly kind: string;
  readonly state: NodeState;
  readonly requires?: readonly string[] | undefined;
  readonly inputHash?: string | undefined;
  readonly why?: string | undefined;
}

/** A pending entry as the output schemas carry it. */
export interface PendingView {
  readonly id: string;
  readonly type: string;
  readonly summary: string;
  readonly status: string;
  readonly source: string;
  readonly author?: string | undefined;
  readonly at: string;
  readonly refs: readonly string[];
  readonly review?: boolean | undefined;
  readonly supersedes?: string | undefined;
}

export interface GateView {
  readonly gate: string;
  readonly ready: boolean;
  readonly done: boolean;
  readonly passedBy?: (typeof GATE_PASSERS)[number] | undefined;
  readonly command?: string | undefined;
  readonly pending: readonly PendingView[];
}

export interface NextReport {
  readonly change: string;
  readonly stage: string;
  readonly artifact?: NodeView | undefined;
  /** With an artifact: the command of the artifact's stage, the skill that does it. */
  readonly command?: string | undefined;
  readonly instruction?: string | undefined;
  readonly gates: readonly GateView[];
  readonly waiting?: Waiting | undefined;
  /** With an `execute-part` node: every ready part and its mode (T41-D3). */
  readonly wave?: readonly WaveItem[] | undefined;
}

/** What `next` found, with the texts its Markdown needs. */
export interface NextOutcome {
  readonly report: NextReport;
  /** Set when the Change is parked. */
  readonly parked?: {
    readonly entry: string;
    readonly summary: string;
    readonly options: readonly string[];
  };
  /** The `pipeline/gate` template, when waiting at a gate. */
  readonly gateText?: string | undefined;
}

export interface ExplainReport {
  readonly artifact: string;
  readonly state: NodeState;
  readonly chain: readonly NodeView[];
  readonly profile: string;
  readonly conditions?: readonly string[] | undefined;
}

export interface ValidateReport {
  readonly artifact: string;
  readonly valid: boolean;
  readonly inputHash?: string | undefined;
  readonly checks: readonly Check[];
}

export interface DoneReport {
  readonly artifact: string;
  readonly state: "done";
  readonly inputHash: string;
  readonly next: string;
  readonly entry?: string | undefined;
}

export function nodeView(node: GraphNode): NodeView {
  return {
    id: node.id,
    kind: node.kind,
    state: node.state,
    ...(node.requires.length === 0 ? {} : { requires: node.requires }),
    ...(node.inputHash === undefined ? {} : { inputHash: node.inputHash }),
    ...(node.why === undefined ? {} : { why: node.why }),
  };
}

export function gateView(gate: GateStatus, pending: (id: string) => PendingView): GateView {
  return {
    gate: gate.gate,
    ready: gate.ready,
    done: gate.done,
    ...(gate.passedBy === undefined ? {} : { passedBy: gate.passedBy }),
    ...(gate.command === undefined ? {} : { command: gate.command }),
    pending: gate.pending.map((entry) => pending(entry.id)),
  };
}

/** The artifact and its transitive requirements, each once: latest pipeline position first, instances in id order. */
export function chainOf(
  start: GraphNode,
  find: (id: string) => GraphNode | undefined,
): GraphNode[] {
  const seen = new Map<string, GraphNode>();
  const visit = (node: GraphNode): void => {
    for (const id of [...(node.instances ?? []), ...node.requires]) {
      const required = find(id);
      if (required === undefined || seen.has(id) || id === start.id) continue;
      seen.set(id, required);
      visit(required);
    }
  };
  visit(start);
  const rest = [...seen.values()].sort(
    (a, b) =>
      b.position - a.position ||
      (a.nn === undefined ? -1 : 1) - (b.nn === undefined ? -1 : 1) ||
      (a.nn ?? "").localeCompare(b.nn ?? ""),
  );
  return [start, ...rest];
}

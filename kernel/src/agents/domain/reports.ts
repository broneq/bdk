// What the `agents` commands answer (`kernel-cli/agents`).
import type { AgentState } from "./state.ts";

type EndSignal = "subagent-stop" | "task-stop" | "agent-result" | "stale";

export interface AgentItem {
  readonly id: string;
  readonly type: string | null;
  readonly state: AgentState;
  readonly parent: string | null;
  readonly session: string | null;
  readonly package: string | null;
  readonly ticket: string | null;
  readonly target: string | null;
  readonly startedAt: string | null;
  readonly lastSeenAt: string | null;
}

export interface AgentsListReport {
  readonly agents: readonly AgentItem[];
}

interface ChildItem {
  readonly id: string;
  readonly type: string | null;
  readonly state: AgentState;
  readonly target: string | null;
}

export interface AgentsShowReport extends AgentItem {
  readonly linkedAt: string | null;
  readonly openCallSince: string | null;
  readonly endedAt: string | null;
  readonly endedBy: EndSignal | null;
  readonly continuations: number;
  readonly children: readonly ChildItem[];
}

export type WaitEvent =
  | { readonly kind: "message"; readonly from: string; readonly entry: string }
  | {
      readonly kind: "report";
      readonly agent: string;
      readonly ticket: string;
      readonly status: string;
    }
  | { readonly kind: "ended"; readonly agent: string; readonly by: EndSignal }
  | { readonly kind: "suspect"; readonly agent: string }
  | { readonly kind: "timeout" };

export type ChildCounts = Readonly<Record<AgentState, number>>;

export interface AgentsWaitReport {
  readonly events: readonly WaitEvent[];
  /** Seconds since the caller's start. */
  readonly elapsed: number;
  readonly children: ChildCounts;
}

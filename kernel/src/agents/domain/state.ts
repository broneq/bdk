// The state of an agent, derived at every read (`kernel-state`, Agent
// registry; T41-D6). Only `ended` rests on a recorded signal; `suspect` is
// never stored, so the next heartbeat makes the agent `running` without a hook.

export type AgentState = "starting" | "running" | "suspect" | "ended";

export const AGENT_STATES: readonly AgentState[] = ["starting", "running", "suspect", "ended"];

/** The recorded signals of one agent, times in milliseconds since the epoch. */
export interface Signals {
  readonly startedMs?: number;
  readonly linkedMs?: number;
  readonly endedMs?: number;
  /** The heartbeat file: `open` while a tool call runs. */
  readonly heartbeat?: { readonly open: boolean; readonly atMs: number };
}

/** Seconds, from `agents.ttl` and `agents.open-call-limit`. */
export interface Lease {
  readonly ttl: number;
  readonly openCallLimit: number;
}

/** The later of the heartbeat and the start; the link before any start. */
export function lastSeenMs(signals: Signals): number | undefined {
  const times = [signals.heartbeat?.atMs, signals.startedMs].filter(
    (value): value is number => value !== undefined,
  );
  if (times.length > 0) return Math.max(...times);
  return signals.linkedMs;
}

export function deriveState(signals: Signals, nowMs: number, lease: Lease): AgentState {
  const { heartbeat, endedMs } = signals;
  if (endedMs !== undefined && (heartbeat === undefined || heartbeat.atMs <= endedMs)) {
    return "ended";
  }
  if (heartbeat?.open === true) {
    if (nowMs - heartbeat.atMs > lease.openCallLimit * 1000) return "suspect";
  } else {
    const last = lastSeenMs(signals);
    if (last !== undefined && nowMs - last > lease.ttl * 1000) return "suspect";
  }
  if (signals.startedMs === undefined && heartbeat === undefined) return "starting";
  return "running";
}

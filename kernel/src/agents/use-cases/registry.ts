// The registry operations the agent hooks, the guards and `bdk agents` share
// (`kernel-state`, Agent registry): recording the lifecycle signals, and the
// view of each agent with its state derived at the time of the call.
import { moduleValue } from "../../shared/config/index.ts";
import type { Mapping } from "../../shared/config/index.ts";
import type { AgentFields, AgentRegistry, AgentRow, EndedBy } from "../../shared/store/index.ts";
import { openCallLimitModule, ttlModule } from "../config.ts";
import { deriveState, lastSeenMs } from "../domain/state.ts";
import type { AgentState, Lease } from "../domain/state.ts";

export interface AgentView {
  readonly id: string;
  readonly type: string | null;
  readonly state: AgentState;
  readonly parent: string | null;
  readonly session: string | null;
  readonly package: string | null;
  readonly ticket: string | null;
  readonly target: string | null;
  readonly startedAt: string | null;
  readonly linkedAt: string | null;
  readonly lastSeenAt: string | null;
  /** When the open tool call began; null without one. */
  readonly openCallSince: string | null;
  readonly endedAt: string | null;
  readonly endedBy: EndedBy | null;
  readonly continuations: number;
}

export function leaseOf(settings: Readonly<Mapping>): Lease {
  return {
    ttl: moduleValue(ttlModule, settings),
    openCallLimit: moduleValue(openCallLimitModule, settings),
  };
}

export function viewOf(
  registry: AgentRegistry,
  row: AgentRow,
  nowMs: number,
  lease: Lease,
): AgentView {
  const heartbeat = registry.heartbeat(row.id);
  const signals = {
    ...ms("startedMs", row.startedAt),
    ...ms("linkedMs", row.linkedAt),
    ...ms("endedMs", row.endedAt),
    ...(heartbeat === undefined ? {} : { heartbeat }),
  };
  const last = lastSeenMs(signals);
  return {
    id: row.id,
    type: row.type,
    state: deriveState(signals, nowMs, lease),
    parent: row.parent,
    session: row.session,
    package: row.package,
    ticket: row.ticket,
    target: row.target,
    startedAt: row.startedAt,
    linkedAt: row.linkedAt,
    lastSeenAt: last === undefined ? null : new Date(last).toISOString(),
    openCallSince: heartbeat?.open === true ? new Date(heartbeat.atMs).toISOString() : null,
    endedAt: row.endedAt,
    endedBy: row.endedBy,
    continuations: row.continuations,
  };
}

export function views(registry: AgentRegistry, nowMs: number, lease: Lease): AgentView[] {
  return registry.all().map((row) => viewOf(registry, row, nowMs, lease));
}

export function findView(
  registry: AgentRegistry,
  id: string,
  nowMs: number,
  lease: Lease,
): AgentView | undefined {
  const row = registry.get(id);
  return row === undefined ? undefined : viewOf(registry, row, nowMs, lease);
}

/** What the parent's `PostToolUse` on `Agent` knows (HOST-FACTS `agent-link`). */
export interface Link {
  readonly id: string;
  readonly parent: string;
  readonly session?: string;
  readonly type?: string;
  readonly package?: string;
  readonly ticket?: string;
  readonly target?: string;
  readonly at: string;
}

/** Records the link; the session and type of an earlier start are kept. */
export function recordLink(registry: AgentRegistry, link: Link): void {
  registry.transaction(() => {
    const stored = registry.get(link.id);
    registry.put(link.id, {
      parent: link.parent,
      linkedAt: link.at,
      ...keep(stored, "session", link.session),
      ...keep(stored, "type", link.type),
      ...optional("package", link.package),
      ...optional("ticket", link.ticket),
      ...optional("target", link.target),
    });
  });
}

/** Records `SubagentStart`, completing a linked row or creating it. */
export function recordStart(
  registry: AgentRegistry,
  start: {
    readonly id: string;
    readonly type?: string;
    readonly session?: string;
    readonly at: string;
  },
): AgentRow {
  registry.transaction(() => {
    const stored = registry.get(start.id);
    registry.put(start.id, {
      startedAt: start.at,
      ...optional("type", start.type),
      ...keep(stored, "session", start.session),
    });
  });
  const row = registry.get(start.id);
  if (row === undefined) throw new Error(`the registry lost agent ${start.id}`);
  return row;
}

/** Records an end signal; a later end replaces an earlier one. */
export function recordEnd(registry: AgentRegistry, id: string, by: EndedBy, at: string): void {
  registry.put(id, { endedAt: at, endedBy: by });
}

/**
 * Ends, as `stale`, every agent of another session that is silent for longer
 * than `agents.ttl`; a session running next to this one keeps its agents.
 */
export function endStaleSessions(
  registry: AgentRegistry,
  session: string | undefined,
  nowMs: number,
  lease: Lease,
  at: string,
): string[] {
  const ended: string[] = [];
  registry.transaction(() => {
    for (const row of registry.all()) {
      if (row.session === session) continue;
      const view = viewOf(registry, row, nowMs, lease);
      if (view.state === "ended") continue;
      const last = view.lastSeenAt === null ? undefined : Date.parse(view.lastSeenAt);
      if (last !== undefined && nowMs - last <= lease.ttl * 1000) continue;
      recordEnd(registry, row.id, "stale", at);
      ended.push(row.id);
    }
  });
  return ended;
}

function ms<K extends string>(key: K, at: string | null): Partial<Record<K, number>> {
  if (at === null) return {};
  const value = Date.parse(at);
  return Number.isNaN(value) ? {} : ({ [key]: value } as Record<K, number>);
}

function optional<K extends keyof AgentFields>(
  key: K,
  value: AgentFields[K] | undefined,
): Partial<AgentFields> {
  return value === undefined ? {} : { [key]: value };
}

/** Sets a field only when the stored row has none, so the first writer wins. */
function keep(
  stored: AgentRow | undefined,
  key: "session" | "type",
  value: string | undefined,
): Partial<AgentFields> {
  if (value === undefined || (stored !== undefined && stored[key] !== null)) return {};
  return { [key]: value };
}

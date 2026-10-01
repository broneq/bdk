// `bdk agents wait` (`kernel-cli/agents`; T41-D1, D8): blocks until the
// caller has something to react to - an admitted message, a child's stored
// report, a child that ended without one or turned suspect - or the timeout.
// Every event is returned once: messages are marked delivered, the other
// events enter the caller's cursor.
import { join } from "node:path";

import { refuse } from "../../shared/refusal/index.ts";
import type { Refusal } from "../../shared/refusal/index.ts";
import { agentsRegistryPath, readDocument, withRegistry } from "../../shared/store/index.ts";
import type { AgentRegistry, Store } from "../../shared/store/index.ts";
import type { AgentsWaitReport, ChildCounts, WaitEvent } from "../domain/reports.ts";
import type { AgentsDeps } from "./deps.ts";
import { leaseFor, notFound } from "./list.ts";
import type { Place } from "./list.ts";
import { viewOf, views } from "./registry.ts";
import type { AgentView } from "./registry.ts";

const WAIT_LIMIT_SECONDS = 540;
export const WAIT_DEFAULT_SECONDS = 300;
/** Well inside the 1.5 s the spec gives from an event to the return. */
const POLL_MS = 500;

export async function waitFor(
  deps: AgentsDeps,
  place: Place,
  id: string,
  timeoutSeconds: number,
): Promise<AgentsWaitReport | Refusal> {
  if (
    !Number.isInteger(timeoutSeconds) ||
    timeoutSeconds < 1 ||
    timeoutSeconds > WAIT_LIMIT_SECONDS
  ) {
    return refuse(
      "input/invalid-argument",
      `--timeout must be a whole number of seconds from 1 to ${String(WAIT_LIMIT_SECONDS)}, got ${String(timeoutSeconds)}`,
      [`bdk agents wait ${id} --timeout ${String(WAIT_DEFAULT_SECONDS)}`],
    );
  }
  const lease = leaseFor(deps, place);
  if ("refused" in lease) return lease;
  if (!deps.store.exists(agentsRegistryPath(place.projectRoot))) return notFound(id);
  const sleep = deps.sleep ?? ((ms: number) => new Promise((done) => setTimeout(done, ms)));
  const now = (): number => Date.parse(deps.clock.now());

  return withRegistry(deps.openRegistry, place.projectRoot, async (registry) => {
    const row = registry.get(id);
    if (row === undefined) return notFound(id);
    const caller = viewOf(registry, row, now(), lease);
    if (caller.state === "ended") {
      return refuse(
        "input/invalid-argument",
        `agent ${id} has ended; an ended agent does not wait`,
        [`bdk agents show ${id}`],
      );
    }
    const since = Date.parse(caller.startedAt ?? caller.linkedAt ?? deps.clock.now());
    const deadline = now() + timeoutSeconds * 1000;
    for (;;) {
      const children = views(registry, now(), lease).filter((view) => view.parent === id);
      const events = collect(deps.store, place.projectRoot, registry, id, children);
      if (events.length > 0 || now() >= deadline) {
        return {
          events: events.length > 0 ? events : [{ kind: "timeout" }],
          elapsed: Math.max(0, Math.floor((now() - since) / 1000)),
          children: counts(children),
        };
      }
      await sleep(Math.min(POLL_MS, Math.max(0, deadline - now())));
    }
  });
}

/** The events not returned before; marks them returned in the same transaction. */
function collect(
  store: Store,
  projectRoot: string,
  registry: AgentRegistry,
  id: string,
  children: readonly AgentView[],
): WaitEvent[] {
  return registry.transaction(() => {
    const seen = registry.seen(id);
    const events: WaitEvent[] = [];
    const keys: string[] = [];
    const add = (key: string, event: WaitEvent): void => {
      if (seen.has(key)) return;
      keys.push(key);
      events.push(event);
    };
    const messages = registry.undelivered(id);
    for (const message of messages) {
      events.push({ kind: "message", from: message.from, entry: message.entry });
    }
    for (const child of children) {
      const report = storedReport(store, projectRoot, child);
      if (report !== undefined && child.ticket !== null) {
        add(`report:${child.id}:${child.ticket}`, {
          kind: "report",
          agent: child.id,
          ticket: child.ticket,
          status: report,
        });
      } else if (child.state === "ended" && child.endedBy !== null) {
        add(`ended:${child.id}:${child.endedAt ?? ""}`, {
          kind: "ended",
          agent: child.id,
          by: child.endedBy,
        });
      }
      if (child.state === "suspect") {
        add(`suspect:${child.id}:${child.lastSeenAt ?? ""}`, { kind: "suspect", agent: child.id });
      }
    }
    registry.markDelivered(messages.map((message) => message.seq));
    registry.markSeen(id, keys);
    return events;
  });
}

function storedReport(store: Store, projectRoot: string, child: AgentView): string | undefined {
  return child.package === null ? undefined : reportStatus(store, projectRoot, child.package);
}

/**
 * The envelope's `status` of the report a dispatch package names, or
 * undefined before `log ingest` stores it; `packagePath` is relative to the
 * project root.
 */
export function reportStatus(
  store: Store,
  projectRoot: string,
  packagePath: string,
): string | undefined {
  const reportPath = field(store, join(projectRoot, packagePath), "report");
  if (reportPath === undefined) return undefined;
  const path = join(projectRoot, reportPath);
  if (!store.exists(path)) return undefined;
  return field(store, path, "status") ?? "unknown";
}

/** A string field of a state document's frontmatter; undefined when absent or unreadable. */
function field(store: Store, path: string, name: string): string | undefined {
  try {
    const document = readDocument(store, path);
    if (document === undefined || !("data" in document)) return undefined;
    const value = (document.data as Readonly<Record<string, unknown>>)[name];
    return typeof value === "string" ? value : undefined;
  } catch {
    return undefined;
  }
}

function counts(children: readonly AgentView[]): ChildCounts {
  const tally = { starting: 0, running: 0, suspect: 0, ended: 0 };
  for (const child of children) tally[child.state] += 1;
  return tally;
}

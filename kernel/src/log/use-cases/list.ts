// `bdk log list`: summaries from the index, and one telemetry line per run
// (at, duration, entry count, whether the index was refreshed).
import type { ActiveChange } from "../../shared/registry/index.ts";
import { appendTelemetry, listEntries } from "../../shared/store/index.ts";
import type { EntryFilter } from "../../shared/store/index.ts";
import { entrySummary } from "../domain/entry.ts";
import type { EntrySummary } from "../domain/entry.ts";
import type { LogDeps } from "./deps.ts";
import { withChangeIndex } from "./deps.ts";

export async function listLog(
  deps: LogDeps,
  change: ActiveChange,
  filter: EntryFilter,
  elapsed: () => number = performanceClock(),
): Promise<EntrySummary[]> {
  const { items, refreshed } = await withChangeIndex(deps, change, (index, refreshed) => ({
    items: listEntries(index, change.id, filter).map(entrySummary),
    refreshed,
  }));
  appendTelemetry(deps.store, change.projectRoot, "log-list", {
    at: deps.clock.now(),
    ms: Math.round(elapsed() * 10) / 10,
    entries: items.length,
    refreshed,
  });
  return items;
}

/** Milliseconds since the call, from the monotonic clock. */
function performanceClock(): () => number {
  const start = performance.now();
  return () => performance.now() - start;
}

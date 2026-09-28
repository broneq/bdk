// `bdk log list`: summaries from the index, and one telemetry line per run
// (at, duration, entry count, whether the index was refreshed).
// `--since-ticket-start` keeps what was written while a ticket ran (T23-D49).
import type { ActiveChange } from "../../shared/registry/index.ts";
import { refuse } from "../../shared/refusal/index.ts";
import type { Refusal } from "../../shared/refusal/index.ts";
import { appendTelemetry, listEntries, readAttempts } from "../../shared/store/index.ts";
import type { EntryFilter } from "../../shared/store/index.ts";
import { entrySummary } from "../domain/entry.ts";
import type { EntrySummary } from "../domain/entry.ts";
import type { LogDeps } from "./deps.ts";
import { withChangeIndex } from "./deps.ts";

export interface ListFilter extends EntryFilter {
  /** Only entries whose `at` is at or after this ticket's `opened-at`. */
  readonly sinceTicket?: string;
}

export async function listLog(
  deps: LogDeps,
  change: ActiveChange,
  filter: ListFilter,
  elapsed: () => number = performanceClock(),
): Promise<EntrySummary[] | Refusal> {
  const { sinceTicket, ...entryFilter } = filter;
  let since: string | undefined;
  if (sinceTicket !== undefined) {
    const record = readAttempts(deps.store, change.dir).find(
      (file) => file.data.ticket === sinceTicket,
    );
    if (record === undefined) {
      return refuse("input/not-found", `${change.id} has no ticket ${sinceTicket}`, [
        "bdk attempt list --all",
      ]);
    }
    since = record.data["opened-at"];
  }
  const { items, refreshed } = await withChangeIndex(deps, change, (index, refreshed) => ({
    items: listEntries(index, change.id, entryFilter)
      .map(entrySummary)
      .filter((item) => since === undefined || item.at >= since),
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

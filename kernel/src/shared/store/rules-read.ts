// The `rules-read` stamp of an attempt record (`kernel-state`, Attempt record;
// T23-D28): `rules show --ticket` stamps it once, `attempt close` reads it.
// It lives in `shared/store` so `rules` stamps the record without importing
// `attempt` (`kernel-architecture`, Dependency matrix).
import { writeDocument } from "./state/documents.ts";
import type { Store } from "./store.ts";
import { readAttempts } from "./work.ts";

/**
 * The ticket's `rules-read` time: the stored one, or `now` after writing it
 * into the record. Undefined when the Change holds no record of the ticket.
 */
export function stampRulesRead(
  store: Store,
  changeDir: string,
  ticket: string,
  now: string,
): string | undefined {
  const record = readAttempts(store, changeDir).find((file) => file.data.ticket === ticket);
  if (record === undefined) return undefined;
  const stamped = record.data["rules-read"];
  if (stamped !== undefined) return stamped;
  writeDocument(store, record.path, {
    data: { ...record.data, "rules-read": now },
    body: record.body,
  });
  return now;
}

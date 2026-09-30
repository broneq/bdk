// A citation is a `refs` item of an entry that parses as a rule id (design
// D-9 of v3-t31); `rules stats` and `rules prune` count the same ones.
import type { EntryRow } from "../../shared/store/index.ts";
import { RULE_ID } from "../../shared/vocabulary/index.ts";

export interface Cited {
  readonly entries: number;
  readonly changes: ReadonlySet<string>;
}

export function citationsOf(entries: readonly EntryRow[]): Map<string, Cited> {
  const cited = new Map<string, { entries: number; changes: Set<string> }>();
  for (const entry of entries) {
    for (const id of new Set(entry.refs.filter((ref) => RULE_ID.test(ref)))) {
      const count = cited.get(id) ?? { entries: 0, changes: new Set<string>() };
      count.entries += 1;
      count.changes.add(entry.changeId);
      cited.set(id, count);
    }
  }
  return cited;
}

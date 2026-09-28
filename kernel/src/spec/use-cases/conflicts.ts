// The archived Changes a delta may conflict with (T30-D1): closed, by their
// `close` transition, after this Change's `change.md` was written. A decision
// of this Change whose refs name the archived Change and the delta resolves it.
import { join } from "node:path";

import { listChangeDirs, readDocument, supersededBy } from "../../shared/store/index.ts";
import type { EntryFacts, Store } from "../../shared/store/index.ts";
import type { ActiveChange } from "../../shared/registry/index.ts";
import { conflictsOf } from "../domain/conflict.ts";
import type { Counterpart } from "../domain/conflict.ts";
import { parseDelta } from "../domain/grammar.ts";
import type { Conflict } from "../domain/reports.ts";
import type { DeltaFile } from "./files.ts";

type Data = Readonly<Record<string, unknown>>;

function entries(store: Store, changeDir: string): Data[] {
  const dir = join(changeDir, "log");
  return store
    .list(dir)
    .filter((name) => name.endsWith(".md"))
    .flatMap((name) => {
      const document = readDocument(store, join(dir, name));
      return document !== undefined && "data" in document ? [document.data] : [];
    });
}

function createdAt(store: Store, changeDir: string): string | undefined {
  const document = readDocument(store, join(changeDir, "change.md"));
  return document !== undefined && "data" in document ? String(document.data.at) : undefined;
}

/** The latest `close` transition's `at`, or undefined for a Change never closed. */
function closedAt(ledger: readonly Data[]): string | undefined {
  return ledger
    .filter((entry) => entry.type === "transition" && entry.to === "close")
    .map((entry) => String(entry.at))
    .sort()
    .at(-1);
}

/** Refs of the live decisions of the Change. */
function decisionRefs(ledger: readonly Data[]): (readonly string[])[] {
  const facts = ledger as unknown as readonly EntryFacts[];
  const superseded = supersededBy(facts);
  return facts
    .filter((entry) => entry.type === "decision" && !superseded.has(entry.id))
    .map((entry) => entry.refs);
}

export function findConflicts(
  store: Store,
  change: Pick<ActiveChange, "id" | "dir" | "projectRoot">,
  deltas: readonly DeltaFile[],
): Conflict[] {
  const since = createdAt(store, change.dir);
  if (since === undefined || deltas.length === 0) return [];
  const decisions = decisionRefs(entries(store, change.dir));
  const closed = listChangeDirs(store, change.projectRoot).flatMap((location) => {
    if (!location.archived || location.id === change.id) return [];
    const at = closedAt(entries(store, location.dir));
    return at !== undefined && at > since ? [location] : [];
  });
  return deltas.flatMap((file) => {
    const ref = `spec-delta/${file.capability}.md`;
    const counterparts: Counterpart[] = closed.flatMap((location) => {
      const text = store.read(join(location.dir, ref));
      if (text === undefined) return [];
      const resolved = decisions.some((refs) => refs.includes(location.id) && refs.includes(ref));
      return [{ change: location.id, delta: parseDelta(text), resolved }];
    });
    return conflictsOf(file.delta, counterparts).map((found) => ({
      capability: file.capability,
      requirement: found.requirement,
      ours: found.ours,
      theirs: found.theirs,
    }));
  });
}

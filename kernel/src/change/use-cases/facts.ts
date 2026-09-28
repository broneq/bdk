// The derived state of one Change from its indexed entries (`kernel-state`,
// Derived state and mutation), shared by status, list, resume and park.
import {
  effectiveProfile,
  findChangeRow,
  isConfirmed,
  isProfile,
  listEntries,
  parkedQuestion,
  stageOf,
} from "../../shared/store/index.ts";
import type { EntryRow, IndexDb, StageMap } from "../../shared/store/index.ts";
import type { Profile } from "../../shared/vocabulary/index.ts";

export interface ChangeFacts {
  readonly entries: readonly EntryRow[];
  readonly kind: string;
  readonly source: string;
  readonly stage: string;
  readonly profile: Profile;
  readonly confirmed: boolean;
  readonly parked: EntryRow | undefined;
}

/**
 * Facts of a refreshed Change; `kind` and `source` come from its `change.md`
 * row, the stage from the latest transition through `stages` (design D-12).
 */
export function changeFacts(index: IndexDb, changeId: string, stages: StageMap): ChangeFacts {
  const change = findChangeRow(index, changeId);
  const entries = listEntries(index, changeId);
  const base = change !== undefined && isProfile(change.profile) ? change.profile : "small";
  return {
    entries,
    stage: stageOf(entries, stages),
    profile: effectiveProfile(base, entries),
    kind: change?.kind ?? "feature",
    source: change?.source ?? "user",
    confirmed: isConfirmed(change?.source ?? "user", entries),
    parked: parkedQuestion(entries),
  };
}

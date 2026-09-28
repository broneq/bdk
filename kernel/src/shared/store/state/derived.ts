// Derived state (`kernel-state`, Derived state and mutation; design D-10 of
// T20): pure functions over entry facts, so the index rows and the documents
// of a unit test give the same answer. Nothing here is ever stored.
import { PROFILES } from "../../vocabulary/index.ts";
import type { Profile } from "../../vocabulary/index.ts";

/** The fields of an entry the derivations read. */
export interface EntryFacts {
  readonly id: string;
  readonly type: string;
  readonly at: string;
  readonly source: string;
  readonly refs: readonly string[];
  readonly supersedes?: string;
  /** `to` of a transition. */
  readonly to?: string;
  readonly park?: boolean;
  readonly profile?: string;
  readonly options?: readonly string[];
}

/** Latest first: by `at`, ties broken by the greater id. */
function latest<T extends EntryFacts>(entries: readonly T[]): T | undefined {
  let best: T | undefined;
  for (const entry of entries) {
    if (best === undefined || entry.at > best.at || (entry.at === best.at && entry.id > best.id)) {
      best = entry;
    }
  }
  return best;
}

/** How a Change's transitions map to stages: the pipeline's, or a test's. */
export interface StageMap {
  /** A node or instance id's pipeline stage; a stage id maps to itself (T21). */
  stage(to: string): string;
  /** The stage's position in the pipeline; later stages rank higher. */
  rank(stage: string): number;
}

/**
 * The stage of the latest transition's target. Two transitions of one
 * millisecond (`done plan-verify` then `part start` in one process) tie: the
 * later stage in pipeline order wins the tie.
 */
export function stageOf(entries: readonly EntryFacts[], stages: StageMap): string {
  let best: { readonly at: string; readonly rank: number; readonly id: string } | undefined;
  let stage = "intent";
  for (const entry of entries) {
    if (entry.type !== "transition" || entry.to === undefined) continue;
    const candidate = stages.stage(entry.to);
    const rank = stages.rank(candidate);
    if (
      best === undefined ||
      entry.at > best.at ||
      (entry.at === best.at && (rank > best.rank || (rank === best.rank && entry.id > best.id)))
    ) {
      best = { at: entry.at, rank, id: entry.id };
      stage = candidate;
    }
  }
  return stage;
}

/** The park question that holds the Change, or undefined when it is not parked. */
export function parkedQuestion<T extends EntryFacts>(entries: readonly T[]): T | undefined {
  const question = latest(
    entries.filter((entry) => entry.type === "question" && entry.park === true),
  );
  if (question === undefined) return undefined;
  const resumed = entries.some(
    (entry) => entry.type === "decision" && entry.refs.includes(question.id),
  );
  return resumed ? undefined : question;
}

/** Superseded id -> the id of the entry naming it in `supersedes`. */
export function supersededBy(entries: readonly EntryFacts[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const entry of entries) {
    if (entry.supersedes !== undefined && !map.has(entry.supersedes)) {
      map.set(entry.supersedes, entry.id);
    }
  }
  return map;
}

export function isProfile(value: string): value is Profile {
  return (PROFILES as readonly string[]).includes(value);
}

export function profileRank(profile: Profile): number {
  return PROFILES.indexOf(profile);
}

export function effectiveProfile(changeProfile: Profile, entries: readonly EntryFacts[]): Profile {
  let result = changeProfile;
  for (const entry of entries) {
    const raised = entry.type === "decision" ? entry.profile : undefined;
    if (raised !== undefined && isProfile(raised) && profileRank(raised) > profileRank(result)) {
      result = raised;
    }
  }
  return result;
}

/** A user Change is confirmed; an inferred one once a user transition exists. */
export function isConfirmed(changeSource: string, entries: readonly EntryFacts[]): boolean {
  if (changeSource !== "inferred") return true;
  return entries.some((entry) => entry.type === "transition" && entry.source === "user");
}

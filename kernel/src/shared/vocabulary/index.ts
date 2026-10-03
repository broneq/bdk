// The closed value lists of `kernel-state` (and the role names of
// `role-contracts`) that the state schemas and the
// slices' `domain/` and `schema/` layers all name. Plain constants with no
// import, so the pure layers may read them (`kernel-architecture`, Slice
// anatomy); the import scan keeps this module free of imports.

export const ENTRY_TYPES = [
  "decision",
  "finding",
  "observation",
  "blocker",
  "question",
  "assumption",
  "risk",
  "learning",
  "report",
  "transition",
] as const;

export type EntryType = (typeof ENTRY_TYPES)[number];

/** The statuses an entry file stores; `superseded` is derived, never stored. */
export const STORED_STATUSES = ["proposed", "accepted", "resolved"] as const;

/** The statuses the kernel reports: the stored ones plus the derived `superseded`. */
export const ENTRY_STATUSES = ["proposed", "accepted", "superseded", "resolved"] as const;

/** Smallest first: a profile only ever rises. */
export const PROFILES = ["tiny", "small", "large"] as const;

export type Profile = (typeof PROFILES)[number];

export const CHANGE_KINDS = ["feature", "bug"] as const;

export type ChangeKind = (typeof CHANGE_KINDS)[number];

/** Who may open a Change: the user, or a skill on the user's behalf. */
export const CHANGE_SOURCES = ["user", "inferred"] as const;

/** The fixed provenance values (P1); every other source is `agent:<role>`. */
export const FIXED_SOURCES = ["user", "policy", "inferred", "kernel"] as const;

const AGENT = "agent:[a-z][a-z0-9-]*";

export const AGENT_SOURCE_PATTERN = new RegExp(`^${AGENT}$`);

/** A fixed provenance value or `agent:<role>`. */
export const SOURCE_PATTERN = new RegExp(`^(${FIXED_SOURCES.join("|")}|${AGENT})$`);

/** A rule id: `CQ-4`, `BDK-SEC-2`; the number never reuses a tombstone's. */
export const RULE_ID = /^[A-Z][A-Z0-9]*(?:-[A-Z][A-Z0-9]*)*-[1-9][0-9]*$/;

/** The loops a ticket counts against; `not-run` is a counter of each loop, not a loop. */
export const LOOPS = [
  "task-redispatch",
  "verify-fix",
  "review-fix",
  "verifier",
  "part-lead",
] as const;

export type Loop = (typeof LOOPS)[number];

/** How much of a review a retry reruns. */
export const TICKET_SCOPES = ["full", "high+", "blockers"] as const;

/** The states of an artifact graph node (`kernel-pipeline`, Node states). */
export const NODE_STATES = ["blocked", "ready", "done", "stale", "skipped"] as const;

export type NodeState = (typeof NODE_STATES)[number];

/** The sources of a transition that passes a gate (`kernel-pipeline`, Gate). */
export const GATE_PASSERS = ["user", "policy"] as const;

/** The role skills under `skills/roles/` (`role-contracts`, Role skills). */
export const ROLES = [
  "implementer",
  "simplifier",
  "verifier",
  "design-verifier",
  "reviewer",
  "integration-reviewer",
  "pr-reviewer",
  "runner",
  "scout",
  "lead",
] as const;

export type Role = (typeof ROLES)[number];

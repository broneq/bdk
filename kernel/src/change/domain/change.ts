// Change ids, profile ranks and the shapes the change commands answer
// (`kernel-cli/change`; `kernel-state`, Identifiers, Derived state and
// mutation). Pure: the use cases read the files and the index.
import type { GATE_PASSERS, NodeState } from "../../shared/vocabulary/index.ts";

const SLUG_MAX = 40;

export const DEFAULT_PARK_OPTIONS = ["accept as debt", "change decision X", "split part"] as const;

export const DEFAULT_PARK_REASON = "Change parked: choose how to continue";

/** Latin letters NFKD does not split into a base letter and an accent. */
const UNDECOMPOSED: Readonly<Record<string, string>> = {
  ł: "l",
  đ: "d",
  ø: "o",
  ß: "ss",
  æ: "ae",
  œ: "oe",
  þ: "th",
  ı: "i",
};

/**
 * The kebab-case slug of the intent's first words: letters without their
 * accents, digits, at most SLUG_MAX characters cut at a word boundary;
 * `change` when the intent yields no slug character.
 */
export function slugOf(intent: string): string {
  const words = intent
    .toLowerCase()
    .normalize("NFKD")
    .replace(/\p{M}+/gu, "")
    .replace(/[łđøßæœþı]/g, (letter) => UNDECOMPOSED[letter] ?? letter)
    .split(/[^a-z0-9]+/)
    .filter((word) => word !== "");
  let slug = "";
  for (const word of words) {
    const next = slug === "" ? word : `${slug}-${word}`;
    if (next.length > SLUG_MAX) {
      if (slug === "") slug = word.slice(0, SLUG_MAX);
      break;
    }
    slug = next;
  }
  return slug === "" ? "change" : slug;
}

/** `<yyyy-mm-dd>-<slug>` from the kernel clock's UTC instant. */
export function changeIdOf(at: string, intent: string): string {
  return `${at.slice(0, 10)}-${slugOf(intent)}`;
}

export function resumeCommand(changeId: string): string {
  return `bdk change resume ${changeId} --option <n>`;
}

export interface NewReport {
  readonly change: string;
  readonly branch: string;
  readonly kind: string;
  readonly profile: {
    readonly value: string;
    readonly defaulted: boolean;
    readonly entry: string;
  };
  readonly source: string;
  readonly overriddenKeys: readonly string[];
  /** The stage command the Change continues with (`graph`, `changeGraph`). */
  readonly next?: string | undefined;
}

interface ParkedView {
  readonly entry: string;
  readonly options: readonly string[];
  readonly resume: string;
}

interface OpenTicketView {
  readonly ticket: string;
  readonly loop: string;
  readonly target: string;
  readonly attempt: number;
  readonly of: number;
  readonly scope: string;
  readonly openedAt: string;
}

/** The closed lists of the change outputs; `schema/` builds its enums from them. */
export const PART_STATES = ["blocked", "ready", "started", "done", "stale"] as const;
export const SPEC_IMPACTS = ["none", "delta"] as const;
export const CHANGE_STATES = ["active", "parked", "archived"] as const;
export const RESUMED_FROM = ["parked", "other-branch", "other-machine"] as const;

/** An artifact graph node as the graph slice reports it. */
interface NodeView {
  readonly id: string;
  readonly kind: string;
  readonly state: NodeState;
  readonly requires?: readonly string[] | undefined;
  readonly inputHash?: string | undefined;
  readonly why?: string | undefined;
}

/** A `review: true` entry listed at a gate, never dispositioned by it. */
interface PendingEntryView {
  readonly id: string;
  readonly type: string;
  readonly summary: string;
  readonly status: string;
  readonly source: string;
  readonly author?: string | undefined;
  readonly at: string;
  readonly refs: readonly string[];
  readonly review?: boolean | undefined;
  readonly supersedes?: string | undefined;
}

/** A gate node's status as the graph slice reports it. */
interface GateView {
  readonly gate: string;
  readonly ready: boolean;
  readonly done: boolean;
  readonly passedBy?: (typeof GATE_PASSERS)[number] | undefined;
  readonly command?: string | undefined;
  readonly pending: readonly PendingEntryView[];
}

/** A plan part as `part list` reports it. */
interface PartView {
  readonly part: string;
  readonly title: string;
  readonly state: (typeof PART_STATES)[number];
  readonly tasks: number;
  readonly done?: number | undefined;
  readonly bytes: number;
  readonly dependsOn?: readonly string[] | undefined;
  readonly specImpact?: (typeof SPEC_IMPACTS)[number] | undefined;
  readonly wave?: number | undefined;
}

export interface StatusReport {
  readonly change: string;
  readonly kind: string;
  /** The effective profile: the largest of `change.md` and every `profile` decision. */
  readonly profile: string;
  readonly source: string;
  readonly confirmed: boolean;
  readonly stage: string;
  readonly parked?: ParkedView | undefined;
  readonly nodes: readonly NodeView[];
  readonly gates: readonly GateView[];
  readonly parts: readonly PartView[];
  readonly openTickets: readonly OpenTicketView[];
  readonly overriddenKeys: readonly string[];
}

export interface ListItem {
  readonly change: string;
  readonly branch?: string | undefined;
  readonly stage: string;
  readonly state: (typeof CHANGE_STATES)[number];
  readonly kind: string;
  readonly profile: string;
  readonly updatedAt: string;
}

export interface ResumeReport {
  readonly change: string;
  readonly branch: string;
  readonly stage: string;
  readonly resumedFrom?: (typeof RESUMED_FROM)[number] | undefined;
  readonly decision?: string | undefined;
  /** The stage command the Change continues with (`graph`, `changeGraph`). */
  readonly next?: string | undefined;
}

export interface ParkReport {
  readonly change: string;
  readonly entry: string;
  readonly options: readonly string[];
  readonly resume: string;
  readonly checkpoint: CheckpointView;
}

/** A checkpoint that ran (`done` with the short commit) or why it was skipped. */
export interface CheckpointView {
  readonly done: boolean;
  readonly commit?: string | undefined;
  readonly skipped?: string | undefined;
}

export interface CheckpointReport extends CheckpointView {
  readonly change: string;
}

export interface TakeoverReport {
  readonly change: string;
  /** The session that held the tickets; stamped from T24. */
  readonly previousSession?: string | undefined;
  readonly closedTickets: readonly string[];
  readonly rebuilt: boolean;
}

export interface CloseReport {
  readonly change: string;
  /** Relative to the project root: `.bdk/changes/archive/<id>`. */
  readonly archivedTo: string;
  readonly spec: { readonly merged: readonly string[]; readonly unchanged: boolean };
  readonly gatesByPolicy: readonly string[];
  readonly summary: string;
}

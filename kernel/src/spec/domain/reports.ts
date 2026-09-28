// What the spec use cases return; `schema/outputs.ts` checks the `--json`
// forms against these shapes.

export const PROBLEM_CODES = [
  "scenario-prefix",
  "when-missing",
  "then-missing",
  "scenario-lost",
  "normative-word",
  "requirement-unknown",
  "requirement-exists",
  "requirement-duplicate",
  "scenario-missing",
  "section-unknown",
  "purpose-missing",
  "delta-empty",
] as const;

export type ProblemCode = (typeof PROBLEM_CODES)[number];

export interface Problem {
  /** 1-based line in the delta. */
  readonly line: number;
  readonly code: ProblemCode;
  readonly message: string;
}

export interface DeltaReport {
  readonly capability: string;
  /** Relative to the project root. */
  readonly path: string;
  readonly valid: boolean;
  readonly problems: readonly Problem[];
}

export interface CheckReport {
  readonly valid: boolean;
  readonly deltas: readonly DeltaReport[];
}

interface MergedCapability {
  readonly capability: string;
  /** Relative to the project root. */
  readonly path: string;
  readonly mergeHash: string;
  readonly added: number;
  readonly modified: number;
  readonly removed: number;
}

export interface Conflict {
  readonly capability: string;
  readonly requirement: string;
  /** This Change's block. */
  readonly ours: string;
  /** The archived Change's block, prefixed by its id. */
  readonly theirs: string;
}

export interface MergeReport {
  readonly merged: readonly MergedCapability[];
  readonly conflicts: readonly Conflict[];
}

type RequirementChange = "added" | "modified" | "removed";

export interface DiffItem {
  readonly name: string;
  readonly change: RequirementChange;
  readonly scenarios: { readonly added: number; readonly removed: number };
}

export interface DiffReport {
  readonly capabilities: readonly {
    readonly capability: string;
    readonly requirements: readonly DiffItem[];
  }[];
}

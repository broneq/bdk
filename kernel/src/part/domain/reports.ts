// What the part commands answer (`kernel-cli/part`); the zod schemas in
// `schema/outputs.ts` check these shapes.

export const PART_STATES = ["blocked", "ready", "started", "done", "stale"] as const;
export type PartState = (typeof PART_STATES)[number];

export interface PartItem {
  readonly part: string;
  readonly title: string;
  readonly state: PartState;
  readonly tasks: number;
  readonly done: number;
  readonly bytes: number;
  readonly dependsOn?: readonly string[] | undefined;
  readonly specImpact: "none" | "delta";
  readonly wave?: number | undefined;
}

export interface PartListReport {
  readonly items: readonly PartItem[];
  readonly total: number;
  readonly truncated: boolean;
}

interface StartedTask {
  readonly task: string;
  readonly files: readonly string[];
  readonly stopRule?: string | undefined;
  readonly verification?: "none" | undefined;
}

export interface PartStartReport {
  readonly part: string;
  readonly state: "started";
  readonly tasks: readonly StartedTask[];
  readonly doNotTouch: readonly string[];
  readonly successMeasure: string;
  readonly entry: string;
  readonly isolation: "shared" | "worktree";
  /** The worktree's absolute path for a part started with `isolation: worktree`. */
  readonly workdir?: string | undefined;
  readonly setup?:
    | { readonly command: string; readonly exitCode: number; readonly durationMs: number }
    | undefined;
  /** A worktree part started in the home checkout because worktrees are disabled. */
  readonly downgraded?: true | undefined;
}

export interface PartDoneReport {
  readonly part: string;
  readonly state: "done";
  readonly commits: readonly { readonly task: string; readonly commit: string }[];
  readonly openFindings: readonly string[];
  readonly entry: string;
  /** The id of the node `bdk next` returns afterwards; absent when none. */
  readonly next?: string | undefined;
  /** A worktree part's merge commit, short SHA (T45). */
  readonly merge?: string | undefined;
  /** Leftovers of the worktree no task declares, dropped with it. */
  readonly discarded?: readonly string[] | undefined;
  /** The checkpoint commit of the Change directory, short SHA; absent when it skipped (#166). */
  readonly checkpoint?: string | undefined;
}

export interface PartSplitReport {
  readonly part: string;
  readonly newPart: string;
  readonly moved: readonly string[];
  readonly entry: string;
}

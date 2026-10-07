// What the attempt commands answer (`schema/cli/output/attempt-*.json`).
// Optional fields carry `| undefined` so the zod output schemas satisfy them.
import type { NextAction, Outcome, Scope } from "./ladder.ts";

/** A post-task step: an agent's role, or the kernel command that records it (#166). */
type PostTaskStep =
  | { readonly kind: string; readonly role: string }
  | { readonly kind: string; readonly command: string };

export interface DroppedFinding {
  readonly id: string;
  readonly summary: string;
}

export interface AttemptOpenReport {
  readonly ticket: string;
  readonly loop: string;
  readonly target: string;
  readonly attempt: number;
  readonly of: number;
  readonly scope: Scope;
  readonly openedAt: string;
  /** A part or verify-fix ticket: `HEAD` of the part's work root at open (#166). */
  readonly base?: string | undefined;
  readonly narrowedFrom?: Scope | undefined;
  readonly dropped?: readonly DroppedFinding[] | undefined;
  /** The kernel `finding` recording the dropped findings for the human. */
  readonly entry?: string | undefined;
  readonly escalation?: { readonly model: string } | undefined;
  /** The post-task steps a code loop runs under the ticket, in pipeline order (T23-D41). */
  readonly steps?: readonly PostTaskStep[] | undefined;
  /** A merge ticket of a worktree part (T45). */
  readonly merge?: true | undefined;
  /** The unmerged paths of a merge ticket. */
  readonly conflicts?: readonly string[] | undefined;
}

export interface DiffReport {
  readonly declared: readonly string[];
  readonly touched: readonly string[];
  readonly undeclared: readonly string[];
}

export interface AttemptCloseReport {
  readonly ticket: string;
  readonly outcome: Outcome;
  readonly diff?: DiffReport | undefined;
  readonly findings?: readonly string[] | undefined;
  readonly fingerprints?: readonly string[] | undefined;
  /** The finding of an implementer that never read its rules (T23-D28). */
  readonly rulesFinding?: string | undefined;
  readonly notRunCount: number;
  readonly next: {
    readonly action: NextAction;
    readonly scope?: Scope | undefined;
    readonly entry?: string | undefined;
    readonly why?: string | undefined;
    readonly resume?: string | undefined;
  };
}

export interface AttemptItem {
  readonly ticket: string;
  readonly loop: string;
  readonly target: string;
  readonly attempt: number;
  readonly of: number;
  readonly scope: Scope;
  readonly openedAt: string;
  readonly closedAt?: string | undefined;
  readonly outcome?: Outcome | undefined;
  readonly escalation?: boolean | undefined;
  readonly entries?: number | undefined;
}

export interface Budget {
  readonly used: number;
  readonly of: number;
}

export interface AttemptListReport {
  readonly items: readonly AttemptItem[];
  readonly budgets?: Readonly<Record<string, Budget>> | undefined;
}

/** One ticket's record (`bdk attempt show`): the list item and, for a code loop, its post-task steps. */
export interface AttemptShowReport extends AttemptItem {
  readonly base?: string | undefined;
  readonly steps?: readonly PostTaskStep[] | undefined;
}

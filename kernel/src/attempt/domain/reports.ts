// What the attempt commands answer (`schema/cli/output/attempt-*.json`).
// Optional fields carry `| undefined` so the zod output schemas satisfy them.
import type { NextAction, Outcome, Scope } from "./ladder.ts";

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
  readonly narrowedFrom?: Scope | undefined;
  readonly dropped?: readonly DroppedFinding[] | undefined;
  /** The kernel `finding` recording the dropped findings for the human. */
  readonly entry?: string | undefined;
  readonly escalation?: { readonly model: string } | undefined;
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

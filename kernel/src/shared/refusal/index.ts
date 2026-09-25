// The one error shape of the kernel (`kernel-cli`, Exit codes and the error
// object): every non-zero exit except 1 prints exactly these four fields, and
// the class before the slash of `rule` decides the exit code.
import * as z from "zod";

/** The rule catalogue of `kernel-cli`; a contract test keeps the two equal. */
export const RULES = [
  "input/unknown-command",
  "input/unknown-flag",
  "input/missing-argument",
  "input/invalid-argument",
  "input/forbidden-field",
  "input/invalid-block",
  "input/not-found",
  "policy/no-active-change",
  "policy/change-exists",
  "policy/gate-not-ready",
  "policy/not-ready",
  "policy/validation-failed",
  "policy/part-too-large",
  "policy/part-too-many-tasks",
  "policy/do-not-touch-overlap",
  "policy/placeholder",
  "policy/budget-exhausted",
  "policy/oscillation",
  "policy/no-open-ticket",
  "policy/ticket-open",
  "policy/package-too-large",
  "policy/do-not-touch",
  "policy/entries-missing",
  "policy/stale-evidence",
  "policy/missing-citation",
  "policy/observation-cap",
  "policy/invalid-transition",
  "policy/git-in-progress",
  "policy/nothing-to-commit",
  "policy/spec-invalid",
  "policy/spec-conflict",
  "policy/merge-hash-mismatch",
  "policy/unknown-config-key",
  "policy/config-invalid",
  "policy/profile-downgrade",
  "policy/rule-format",
  "policy/duplicate-rule-id",
  "guard/subagent-git",
  "guard/subagent-kernel-command",
  "guard/hooks-from-bash",
  "guard/spec-dir-write",
  "guard/kernel-unavailable",
  "state/corrupted-index",
  "state/ledger-invalid",
  "state/trailer-mismatch",
  "state/change-dir-missing",
  "runtime/node-version",
  "runtime/not-a-repo",
  "runtime/git-missing",
  "kernel/not-implemented",
] as const;

export type Rule = (typeof RULES)[number];

export type RuleClass = "policy" | "guard" | "input" | "state" | "runtime" | "kernel";

export type RefusalExit = 2 | 3 | 4 | 5;

const EXIT_BY_CLASS: Record<RuleClass, RefusalExit> = {
  policy: 2,
  guard: 2,
  kernel: 2,
  input: 3,
  state: 4,
  runtime: 5,
};

export interface Refusal {
  readonly refused: true;
  readonly rule: Rule;
  readonly why: string;
  readonly instead: readonly [string, ...string[]];
}

export function ruleClass(rule: Rule): RuleClass {
  return rule.slice(0, rule.indexOf("/")) as RuleClass;
}

export function exitCodeFor(rule: Rule): RefusalExit {
  return EXIT_BY_CLASS[ruleClass(rule)];
}

/** Builds a refusal; `why` carries the concrete values, `instead` at least one next action. */
export function refuse(rule: Rule, why: string, instead: readonly string[]): Refusal {
  const [first, ...rest] = instead;
  if (why.length === 0) throw new Error(`refusal ${rule} needs a why`);
  if (first === undefined) throw new Error(`refusal ${rule} needs at least one instead`);
  return { refused: true, rule, why, instead: [first, ...rest] };
}

/** Carries a refusal out of code that cannot return one, e.g. a shared OS boundary. */
export class KernelRefusal extends Error {
  readonly refusal: Refusal;

  constructor(refusal: Refusal) {
    super(`${refusal.rule}: ${refusal.why}`);
    this.name = "KernelRefusal";
    this.refusal = refusal;
  }
}

/** `schema/cli/common/refusal.json`, narrowed to the catalogue; a contract test keeps them equal. */
export const refusalSchema = z.strictObject({
  refused: z.literal(true),
  rule: z.enum(RULES),
  why: z.string().min(1),
  instead: z.array(z.string().min(1)).min(1),
});

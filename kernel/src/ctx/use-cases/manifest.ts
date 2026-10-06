// The context manifest (`kernel-cli/ctx`, `bdk ctx skill`; design D-3): what
// each skill's context lines inject, in output order. A skill is listed here
// exactly when its SKILL.md carries the context lines; the skill context
// contract test keeps both sets equal and checks that every part resolves.
import type { RuleStage } from "../../shared/vocabulary/index.ts";

type ToolGroup = "test" | "lint" | "build";

export type Part =
  /** The rules the stage reads over the work tree files; omitted when it selects none. */
  | { readonly kind: "rules"; readonly stage: RuleStage }
  /** `lavish` or `ask-user` of `fragments/decision/*`, chosen by R-11. */
  | { readonly kind: "fragment"; readonly id: "decision" }
  | { readonly kind: "tools"; readonly group: ToolGroup }
  /** `execution.concurrency` as one sentence (T23-D52). */
  | { readonly kind: "concurrency" }
  /** Every leaf key by setup class with its value and origin (`kernel-settings`, Setup classification; T56). */
  | { readonly kind: "setup-coverage" }
  /** `policy.verifier`: the blocking categories and the not-a-fail list (P8, T42). */
  | { readonly kind: "verifier-policy" }
  /** A plugin file, verbatim; `path` is relative to the plugin root. */
  | { readonly kind: "file"; readonly path: string; readonly title: string };

const rules = (stage: RuleStage): Part => ({ kind: "rules", stage });
const tools = (group: ToolGroup): Part => ({ kind: "tools", group });
const decision: Part = { kind: "fragment", id: "decision" };
const verifierPolicy: Part = { kind: "verifier-policy" };

export const SKILL_CONTEXT: Readonly<Record<string, readonly Part[]>> = {
  // A stage skill that needs no settings keeps its context lines for the
  // `BDK STOP` line when the kernel is unavailable.
  adr: [rules("design")],
  change: [],
  close: [],
  commit: [],
  cr: [verifierPolicy],
  design: [rules("design"), verifierPolicy, decision],
  docs: [],
  diagnose: [],
  doctor: [],
  execute: [{ kind: "concurrency" }, decision],
  plan: [rules("plan"), verifierPolicy, decision],
  "pr-review": [
    {
      kind: "file",
      path: "skills/tools/pr-review/references/comment-templates.md",
      title: "Comment templates",
    },
  ],
  rules: [decision],
  run: [],
  setup: [tools("test"), tools("lint"), tools("build"), { kind: "setup-coverage" }],
  swarm: [{ kind: "concurrency" }],
  "verify-design": [],
  "verify-plan": [],
};

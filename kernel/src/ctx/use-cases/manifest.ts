// The context manifest (`kernel-cli/ctx`, `bdk ctx skill`; design D-3): what
// each skill's context lines inject, in output order. A skill is listed here
// exactly when its SKILL.md carries the context lines; the skill context
// contract test keeps both sets equal and checks that every part resolves.
type ToolGroup = "test" | "lint" | "build";

export type Part =
  /** The pack's rules of one category directory (`rule-pack`, Pack layout). */
  | { readonly kind: "rules"; readonly category: string }
  | { readonly kind: "language-rules" }
  /** The rules of `.bdk/rules/`; omitted when there are none. */
  | { readonly kind: "project-rules" }
  /** `lavish` or `ask-user` of `fragments/decision/*`, chosen by R-11. */
  | { readonly kind: "fragment"; readonly id: "decision" }
  | { readonly kind: "tools"; readonly group: ToolGroup }
  /** `execution.concurrency` as one sentence (T23-D52). */
  | { readonly kind: "concurrency" }
  /** A plugin file, verbatim; `path` is relative to the plugin root. */
  | { readonly kind: "file"; readonly path: string; readonly title: string };

const rules = (category: string): Part => ({ kind: "rules", category });
const tools = (group: ToolGroup): Part => ({ kind: "tools", group });
const decision: Part = { kind: "fragment", id: "decision" };
const languageRules: Part = { kind: "language-rules" };
const projectRules: Part = { kind: "project-rules" };

export const SKILL_CONTEXT: Readonly<Record<string, readonly Part[]>> = {
  "bdk-implementer-return-contract": [
    {
      kind: "file",
      path: "skills/subagent-execute-plan/references/return-contract.md",
      title: "Return contract",
    },
  ],
  "bdk-lint-tools": [tools("lint")],
  "bdk-rules-architecture": [rules("architecture")],
  "bdk-rules-code-quality": [rules("code-quality")],
  "bdk-rules-design-patterns": [rules("design-patterns")],
  "bdk-rules-languages": [languageRules],
  "bdk-rules-security": [rules("security")],
  "bdk-test-tools": [tools("test")],
  // A stage skill that needs no settings keeps its context lines for the
  // `BDK STOP` line when the kernel is unavailable.
  change: [],
  cr: [
    { kind: "file", path: "skills/cr/references/review-engine.md", title: "Review engine" },
    { kind: "file", path: "skills/cr/references/report-format.md", title: "Report format" },
  ],
  "create-adr": [rules("architecture")],
  debug: [tools("test"), tools("lint")],
  design: [rules("architecture"), rules("engineering-judgment"), projectRules, decision],
  plan: [
    rules("plan"),
    rules("engineering-judgment"),
    rules("test-quality"),
    languageRules,
    projectRules,
    decision,
  ],
  "pr-review": [
    {
      kind: "file",
      path: "skills/pr-review/references/reviewer-prompt.md",
      title: "Reviewer prompt",
    },
  ],
  setup: [tools("test"), tools("lint"), tools("build")],
  swarm: [{ kind: "concurrency" }],
  "test-driven-development": [rules("test-quality"), tools("test")],
  "verify-design": [],
  "verify-plan": [],
};

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
  /** `policy.verifier`: the blocking categories and the not-a-fail list (P8, T42). */
  | { readonly kind: "verifier-policy" }
  /** A plugin file, verbatim; `path` is relative to the plugin root. */
  | { readonly kind: "file"; readonly path: string; readonly title: string };

const rules = (category: string): Part => ({ kind: "rules", category });
const tools = (group: ToolGroup): Part => ({ kind: "tools", group });
const decision: Part = { kind: "fragment", id: "decision" };
const languageRules: Part = { kind: "language-rules" };
const projectRules: Part = { kind: "project-rules" };
const verifierPolicy: Part = { kind: "verifier-policy" };

export const SKILL_CONTEXT: Readonly<Record<string, readonly Part[]>> = {
  // A stage skill that needs no settings keeps its context lines for the
  // `BDK STOP` line when the kernel is unavailable.
  adr: [rules("architecture")],
  change: [],
  close: [],
  commit: [],
  cr: [verifierPolicy],
  design: [
    rules("architecture"),
    rules("engineering-judgment"),
    projectRules,
    verifierPolicy,
    decision,
  ],
  docs: [],
  diagnose: [],
  doctor: [],
  execute: [{ kind: "concurrency" }, decision],
  plan: [
    rules("plan"),
    rules("engineering-judgment"),
    rules("test-quality"),
    languageRules,
    projectRules,
    verifierPolicy,
    decision,
  ],
  "pr-review": [
    {
      kind: "file",
      path: "skills/tools/pr-review/references/comment-templates.md",
      title: "Comment templates",
    },
  ],
  rules: [decision],
  run: [],
  setup: [tools("test"), tools("lint"), tools("build")],
  swarm: [{ kind: "concurrency" }],
  "verify-design": [],
  "verify-plan": [],
};

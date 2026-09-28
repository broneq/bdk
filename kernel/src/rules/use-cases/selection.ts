// Which rules a role reads (T23-D27), held in the kernel: the rule sets by role, and whether the
// language rules follow them. Selection ignores the target's files until T31
// selects by rule id and `applies`.
import type { Role } from "../../shared/vocabulary/index.ts";
import type { RuleCategory } from "../config.ts";

export interface RoleRules {
  readonly categories: readonly RuleCategory[];
  readonly languages: boolean;
}

const WRITERS: RoleRules = {
  categories: ["code-quality", "architecture", "design-patterns", "security", "test-quality"],
  languages: true,
};

const NONE: RoleRules = { categories: [], languages: false };

export const ROLE_RULES: Readonly<Record<Role, RoleRules>> = {
  implementer: WRITERS,
  reviewer: WRITERS,
  "pr-reviewer": WRITERS,
  verifier: {
    categories: ["architecture", "test-quality", "engineering-judgment"],
    languages: false,
  },
  "design-verifier": {
    categories: ["architecture", "engineering-judgment", "security"],
    languages: false,
  },
  runner: NONE,
  scout: NONE,
};

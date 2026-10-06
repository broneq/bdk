---
paths:
  - "skills/**"
  - "agents/**"
---

# Skills and agents

- A skill writes under `.bdk/` only through `bdk` commands and never creates a directory of its own there.
- A skill that starts a role agent passes the package path from `bdk dispatch build`, never a resolved command, because the kernel puts the project's `tools.*` commands into the package.
- A skill whose job is discovering the stack, such as `setup`, names runners in its derivation tables by necessity; never rewrite those tables into generic prose.
- A skill that only makes sense for one language stack or domain does not belong in `skills/`; it goes into that project's `.claude/`.
- A skill directory holds no `fragments/`: conditional content is a part of the skill's entry in `kernel/src/ctx/use-cases/manifest.ts`.
- Hook scripts live in `hooks/<hook-name>/`, never in `skills/`, and a skill's own hook never duplicates a global hook of `hooks/hooks.json`.
- A skill that needs another skill checks for it at start with a `once: true` `UserPromptSubmit` hook running `bdk hooks skill-exists <skill-name>` through the bundle path, with the kernel-unavailable `echo` fallback.

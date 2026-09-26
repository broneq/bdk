---
description: How a skill receives settings-derived prompt context (rules, language rules, fragments, project commands, plugin files)
paths:
  - "skills/**"
  - "agents/**"
  - "fragments/**"
  - "rules/**"
  - "kernel/src/ctx/**"
---

# Skill Context

A skill gets settings-derived content from exactly one place: `bdk ctx skill <name>`, called by the two context lines at the top of its body (`kernel-cli` spec, Output modes, Context lines of a skill). The first line is the `!` accelerator for Claude Code; the second is the fallback sentence that makes the model run the same command when the host did not run the `!` line. The skill body then points to the sections by title (`Rules: <category>`, `Language rules: <language>`, `Asking the user`, `Project commands: <group>`, a file part's title) instead of repeating their content.

What a skill receives is its entry in the typed manifest `kernel/src/ctx/use-cases/manifest.ts`. To give a skill more context, add a part there, not a `!` line. A fragment is a prompt key declared in `kernel/src/ctx/config.ts` with its default under `fragments/`, so a project can extend or replace it like a rule set.

A subagent gets the same content through a preloaded meta-skill (`skills:` in the agent frontmatter) whose body is its own context lines; agent files cannot run `!` lines, and plugin agents lose `hooks:`.

Enforced by `kernel/tests/contract/skill-context.test.ts` (line form read from the spec, own skill name, no other kernel, inject or `cat` `!` line, manifest set equals the skill set, every part resolves) and by `pnpm skill-check` (wrapper form and the `allowed-tools` pair).

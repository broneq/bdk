---
description: BDK-only conventions for skills and agents; generic authoring lives in the bdk-skill-kit skills
paths:
  - "skills/**"
  - "agents/**"
  - ".claude/skills/**"
---

# Skills and Agents in BDK

Write or review a skill or an agent with `/bdk-skill-kit:skill-authoring`. It holds the generic rules: frontmatter, invocation, layout, size, references, substitutions, hooks, subagent dispatch, process versus knowledge. Run `pnpm skill-check` before committing; `pnpm skill-check --list-rules` prints every enforced rule. This file holds only what is specific to BDK.

## Enforced by `pnpm skill-check`

BDK's settings of the kit rules live in `skill-check.config.ts`:

- **`!` blocks call only the kernel.** A `!` block is a whole line in the content-wrapper form of the kernel-cli spec (Invocation), and the skill lists `Bash(node "${CLAUDE_PLUGIN_ROOT}/dist/bdk.mjs" *) Bash(echo *)` in `allowed-tools`. Without the pair the host drops the whole skill in default permission mode. The config reads both from the spec.
- **No MCP tools.** BDK ships no MCP server (ADR-0001), so a `mcp__plugin_bdk_` name fails silently at user runtime.
- **Gates.** `plan`, `execute`, `close` and `run` are user-only. `execute` and `close` delegate edits, so they disallow `Edit`, `Write` and `NotebookEdit`.
- **Namespaced references.** `/bdk:<name>` and `subagent_type: bdk:<name>`; another plugin's skill is a warning, because BDK cannot rely on it being installed.
- **Language-agnostic commands** (`.claude/rules/portability-check.md`); the `setup` skill is exempt.
- **Listing budget.** A description is at most 250 characters, below the host cap.
- **Context lines.** `kernel/tests/contract/skill-context.test.ts` checks the two context lines and the manifest (`.claude/rules/skill-context.md`).
- **Baseline.** v2 findings sit in `skill-check.baseline.json` until T41 and T42 replace that content. It only shrinks: fix a finding and run `pnpm skill-check --baseline-prune`; never add entries.

## Not enforced

- A skill directory holds no `fragments/`: conditional content is a part of the skill's `ctx skill` manifest entry (`.claude/rules/skill-context.md`).
- Hook scripts live in `hooks/<hook-name>/`, never in `skills/`. A skill hook must not duplicate a global hook in `hooks/hooks.json`.
- A skill that needs another skill checks for it at start with a `UserPromptSubmit` hook running `node "${CLAUDE_PLUGIN_ROOT}/dist/bdk.mjs" hooks skill-exists <skill-name>` with the kernel-unavailable `echo` fallback and `once: true` (see `skills/commit/SKILL.md`). The kernel prints one line when the skill is missing and nothing otherwise.

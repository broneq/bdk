# Proposal

## Why

Plan: docs/V3-IMPLEMENTATION-PLAN.md, T01. Tracks #46.

The v3 gate, write-channel and working-tree guarantees (T1, T2, T3) and the orchestrator tool lock (P9) rest on Claude Code hook and frontmatter behaviour. The raw docs only partly pin that behaviour down: design, "Existing Codebase Context" / "Host facts verified" and "What We Did NOT Decide" / "Live checks". The Risk Register row "Host hook semantics move under us" asks for these facts to be checked live before the kernel skeleton (T11) and the guard hooks (T24) are built on them, and for real payloads to be recorded so a host change fails CI instead of a user. T10 (CLI contract) also waits on the `UserPromptExpansion` answer, because a NO adds `bdk stage enter`.

## What Changes

- A reusable **host probe**: a throwaway Claude Code plugin under `tests/host-probe/` whose hooks write every payload they receive to disk, plus probe skills and a probe agent that set up each check. It stays in the repo so the checks can be rerun after a Claude Code upgrade.
- **Recorded payloads** as fixtures under `tests/fixtures/host-payloads/<claude-code-version>/`, one file per check. Machine-specific values such as the home path and session IDs are replaced with placeholders.
- **`docs/HOST-FACTS.md`**: a table of fact / result (YES / NO / NOT APPLICABLE) / host version / fixture / how it was checked, covering every item in the T01 Scope:
  - `UserPromptExpansion`: the `command_name` form for a plugin skill, `command_source`, `prompt`, `command_args`; whether `disable-model-invocation: true` also blocks the model's `Skill` tool call.
  - `PreToolUse`: whether user `!` bash-mode commands reach it; whether background plugin subagents carry `agent_id` like foreground ones; the `tool_input` shape for `Bash`, `Edit`, `Write`, `MultiEdit` and `NotebookEdit`.
  - `SessionEnd`: whether it fires on `/clear` and on a killed session; its payload.
  - `allowed-tools`: whether `Bash(node ${CLAUDE_PLUGIN_ROOT}/dist/bdk.mjs *)` pre-approves `node ... || echo ...` (V2-4).
  - `disallowed-tools`: whether it clears on the next user message (P9).
  - `node:sqlite`: the minimum Node version without a flag, its stability status, and the user's Node versions.
- If the `UserPromptExpansion` result is NO, `docs/HOST-FACTS.md` describes the `bdk stage enter` fallback (design, "Key boundaries", T1 paragraph) as input for T10 and T24.
- The design text is not edited. Where a live result contradicts it, `docs/HOST-FACTS.md` names the design line and the tasks affected.

## Capabilities

### New Capabilities

None. The change records facts about the host and adds test fixtures; no BDK behaviour changes. `.openspec.yaml` sets `skip_specs: true`.

### Modified Capabilities

None.

## Impact

- New files only: `tests/host-probe/`, `tests/fixtures/host-payloads/`, `docs/HOST-FACTS.md`. Nothing under `skills/`, `agents/`, `hooks/` or `scripts/` changes, and the shipped plugin does not load the probe.
- Consumers: T10 (the `hooks` command group and a possible `stage enter`), T11 (minimum Node for `node:sqlite`), T24 (hook matchers, prefilter and payload parsing, recorded payloads as E2E input), T41 (the `allowed-tools` wrapper form and `disallowed-tools` on `execute` / `close`).
- Some checks need a person at an interactive session (typing a command, `!` mode, `/clear`, killing the process). The user runs those from a short checklist; the rest run headless.
- Out of scope: building the kernel hooks themselves (T24), the CLI contract (T10), content tests for skill frontmatter (T41 / T42).

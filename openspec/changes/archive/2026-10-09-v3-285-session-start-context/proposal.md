# Proposal

## Why

Tracks #285 (replaces #142; #143's behaviour is already what v3 does).

The `SessionStart` hook of the `bdk` plugin adds a few lines to every session of a configured project (spec `bdk-cli/hooks`, "Session start context"), but nobody decided what those lines are for. Every line costs context in every session, also in sessions that never run a BDK command, while skills and agents already get their own context (each skill's configuration block, `bdk rules for`, agent prompts). The content has to earn its place by what the main session needs before any skill runs, not by habit carried over from v2's `STARTUP_INSTRUCTIONS.md`.

## What Changes

- State the purpose of the session start context: what the main session must already know before any `/bdk:*` skill runs, and why the hook (not a skill or the project's `CLAUDE.md`) is the place for it.
- Decide its content and its limit, and whether parts of it are computed from the project state (an active Change or run under `.bdk/runs/`, a failed run) rather than static.
- Change `bdk hooks session-start` and its spec to that content. **BREAKING**: the lines naming `bdk config show` and `bdk --help` and the `hooks.subagent-git` note leave the context.
- Name where each candidate that is not kept belongs instead: the `bdk` CLI skill of #286, a `CLAUDE.md` block written by `/bdk:setup`, or nowhere.
- Keep the behaviour outside a configured project: one warning, nothing injected (spec "Session start warning without configuration").

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `bdk-cli/hooks`: "Session start context" changes to the designed purpose, content and limit, possibly computed from the project state.

## Out of scope

- The skill that teaches the main session the `bdk` CLI (#286); this Change only draws the boundary with it.
- The `PreToolUse` guard `hooks.subagent-git` and its git parsing; only its note in the session start context is in scope.
- A with / without measurement of the context: the user decided against it (design.md, D5).
- The deferred `Stop`/`SubagentStop` hook engine (architecture, "Autopilot continuation").
- The warning outside a configured project or with an invalid configuration, which stays as it is.

## Impact

- Code: `plugins/bdk/src/hooks/use-cases/session-start.ts` and its tests in `plugins/bdk/src/hooks/tests/commands.test.ts`.
- Specs: `openspec/specs/bdk-cli/hooks/spec.md`.
- Users: what the model knows at the start of every session in a BDK project. Docs: `docs/concepts/cli-config-hooks.md` (Hooks section and the settings table) and the regenerated `docs/reference/bdk/hooks.md`; `docs/guide/install.md` and `docs/guide/first-run.md`, which mention the session start context.

## Why

Tracks #182.

The architecture keeps exactly two hooks in v3 (`docs/design/2026-10-07-v3-architecture.md`, "Hooks"; ADR-0003, "Hooks"): a `SessionStart` hook that gives a short BDK context, or one warning when the project has no configuration, and an optional `PreToolUse` guard `hooks.subagent-git` that stops worker subagents from changing git history while the lead commits and merges. The recorded problem behind the guard is the architecture's risk "Guard blocks the merge-back" and its validation rows 1 and 3: an autopilot run has several agents in one repository, and a worker that commits, resets or stashes changes history the lead owns ("Constraints & NFRs", "Permissions of the autopilot": only the lead and the main thread commit). The `SessionStart` warning is the one place a user learns that BDK is installed but not set up before a skill fails on it. The setting `hooks.subagent-git` already exists in the configuration (#179, default `false`); nothing reads it yet.

## What Changes

- New command group `hooks` in the `bdk` CLI with two verbs that speak the host's hook protocol: `bdk hooks session-start -` and `bdk hooks pre-tool-use -`, each reading the hook payload from stdin (the `-` argument of the frame's "No waiting on input").
- `session-start`: in a configured project, a short BDK context for the model; without a configuration (or with an invalid one), one warning for the user and nothing injected.
- `pre-tool-use`: with `hooks.subagent-git: true`, denies a `Bash` call of a subagent other than `bdk:lead` whose command changes git history; allows everything else. Resolves the issue's "To resolve in the spec": how the guard recognises a git history change (a fixed table of git subcommands and forms, read from the command words of every simple command, nested `sh -c`/`eval` strings and command substitutions included).
- `plugins/bdk/hooks/hooks.json` registers both, calling `node "${CLAUDE_PLUGIN_ROOT}/dist/bdk.mjs" hooks <event> -` (the draft 1 hook model); a broken guard never blocks a tool call.
- A new OS boundary `shared/stdin` reads stdin for the `-` argument.

## Capabilities

### New Capabilities

- `bdk-cli/hooks`: the `bdk hooks` commands - payload input, the host hook output, the session-start context and warning, the subagent-git guard and how it recognises git history changes, and their registration in `hooks/hooks.json`.

### Modified Capabilities

None. The frame and architecture requirements of `bdk-cli` and the `hooks.subagent-git` key of `bdk-cli/config` apply unchanged.

## Impact

- `plugins/bdk/src/hooks/` (new slice), its row in `src/slices.ts` (imports `config`), its entry in `src/main.ts`, the new `src/shared/stdin/` boundary and its `SHARED` row.
- `plugins/bdk/hooks/hooks.json` (new): every session of a project with the plugin installed runs the `SessionStart` hook, and every `Bash` call runs the guard (about 50 ms of Node start-up).
- Out of scope: `/bdk:setup`, which writes the configuration the warning points to (#181); the `bdk:lead` agent and the autopilot run that turns the guard on (later tasks); the draft 1 hooks the architecture removed (process-order, write-scope and agent-tree guards, the registry, the journal, the stage gate, `SessionEnd`).

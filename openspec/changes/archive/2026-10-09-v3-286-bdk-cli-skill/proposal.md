# Proposal

## Why

Tracks #286 (blocked by #285, merged).

The `bdk` CLI has nine command groups. The session start context (#285) deliberately names no CLI command, so the main session knows the process (`/bdk:*` stages) but not which command answers "show the config", "why did the run stop" or "what is in this review round". It can run `bdk --help`, but only if it thinks of it, and it cannot tell a read command from one that belongs to a stage skill.

## What Changes

- New skill `/bdk:cli` (`plugins/bdk/skills/cli/`): a thin reference and router in one. It maps a question about the project's BDK state to the command group that answers it, says how to read the output and exit codes, names the commands that only stage skills call, and sends work (not questions) to the `/bdk:*` skill that does it. Usage detail stays in `bdk --help`.
- A drift test (`scripts/cli-skill.test.ts`): every `bdk <group> <verb>` the CLI declares is named in the skill, and the skill names no command the CLI lacks. A new or renamed command fails `pnpm test` until the skill follows.
- Four eval cases `cli-*` (`plugins/bdk/evals/`), with and without the plugin.
- Docs: Guide and Concepts pages name the skill.

## Capabilities

### New Capabilities

- `bdk-cli-skill`: the `/bdk:cli` skill, its drift check and its eval cases.

### Modified Capabilities

None.

## Out of scope

- The session start context (#285): unchanged; it does not name this skill, the skill's description loads like any other.
- A generated reference of the CLI: `docs/reference/bdk/cli.md` and `bdk --help` already are one (D2).
- New `bdk` commands: none is added (D4).

## Impact

- Code: `plugins/bdk/skills/cli/SKILL.md`, `scripts/cli-skill.test.ts`, `plugins/bdk/evals/cli-*`, `plugins/bdk/evals/README.md`.
- Specs: new `openspec/specs/bdk-cli-skill/spec.md`.
- Users: the main session answers questions about BDK state through the CLI. Docs: `docs/concepts/cli-config-hooks.md` and `docs/guide/` page that lists the skills; the Reference is regenerated (new skill page).

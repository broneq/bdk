# Proposal

## Why

Tracks #410. `bdk:explorer` runs on `haiku`, and on a Next.js + Convex + Playwright project its maps missed facts that decide how the Change can run: a hook that blocks a direct test-runner call, a budget wrapper script and a test `globalSetup` that spawns its own server were found by hand (issue #410, Input). The explorer must run on at least `sonnet`, and the map must name such facts.

## What Changes

- `plugins/bdk/agents/explorer.md` moves from `model: haiku` to the model the measurement picks between `sonnet` and `opus` (design, "Measurement"); a project still sets another one with `models.explorer.model`.
- The `explore` skill follows the test command to the script it runs and the runner's setup files, and reads the project's rules for the commands the Change runs (`CLAUDE.md` or `AGENTS.md`, the hooks of `.claude/settings.json`, the docs on build, test and run); a hook, wrapper or setup step that changes how a command runs goes under `Patterns` or `Gaps`.
- New block case `explore-project-facts`: `ledger-proposal.sh` plus a test budget wrapper, a test global setup that starts the ledger server, and a Claude Code hook that blocks a direct `node --test`; it grades that the map names all three.
- The explore eval cases and the explore step of `/bdk:design` (`design-fresh-auto-gate`) run on the compared models; result and cost recorded in the design and in `plugins/bdk/evals/README.md`.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `design-blocks`: the explorer's model, what the map covers (test wrapper and setup, the project's rules), and the new eval case.
- `bdk-cli/config`: the scenario "Role not set" names the explorer's new frontmatter model.

## Out of scope

- Other agents' models.
- A CLI helper or hook for exploration: no measurement shows a need (CLAUDE.md, "Building skills (v3)").

## Impact

- `plugins/bdk/agents/explorer.md`, `plugins/bdk/skills/explore/SKILL.md`, `plugins/bdk/evals/explore-project-facts/`, `plugins/bdk/evals/README.md`.
- User docs that name the explorer's model: `docs/guide/footprint.md`, `docs/concepts/stages.md`, `docs/concepts/agents.md` (its diagram and table), `docs/concepts/orchestrators.md` (its diagram); Reference regenerated (`docs/reference/bdk/agents.md`). `docs/design/2026-10-07-v3-architecture.md` names the model in its table of blocks and is updated too.
- Cost: each explore run spends more per token; the map is one run per design.

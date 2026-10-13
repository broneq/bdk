# Proposal

## Why

Tracks #407. On a Next.js + Convex + Playwright project `/bdk:setup` read only manifests, scripts and a few configs: it missed a hook that blocks a direct Playwright run, a budget wrapper around the E2E suite, a Playwright `globalSetup` that starts the server itself, a `CLAUDE.md` rule for a heavy suite and a `build` script that deploys; it wrote no item for the Playwright suite without saying why, and asked for an E2E `start` that needs a cloud deployment (issue #407, Input). Setup must map how the project really runs its checks before it decides, whatever the stack, and account for every tool it leaves out.

## What Changes

- New block `explore-project` (`/bdk:explore-project`) on the agent `bdk:explorer` (sonnet, #410): maps how a project builds, tests, lints and runs, stack-agnostic, into `.bdk/runs/setup/project-map.md`. Its brief names what to find, never a stack: the project's rules (`CLAUDE.md`, `AGENTS.md`, `.claude/rules/`, hooks of `.claude/settings.json`), wrapper scripts around tests and E2E with the rules that say when to run them, test and E2E configs with the setup that starts its own server, CI workflows, folders a tool skips, and scripts with side effects.
- `/bdk:setup` runs on `opus` (`model: opus` in its frontmatter) and starts the block as its new step 2, before it detects; the detection, the E2E entry and the report use the map.
- `references/stacks.md`: how to detect a wrapper script around a test or E2E suite, that its item runs the wrapper and never the bare runner, when a `{files}` item may go through it, and the `when` it gets; a hook or rule that forbids the bare runner is honoured.
- The report holds one line for every detected tool setup leaves out, with the reason and the file that shows it.
- `references/e2e.md`: the case where the project's own suite owns the server (a `globalSetup` or fixture that starts it, no `webServer`), and the recommended `start` and `ready`: the server command and port the suite uses, not a `dev` script that needs a cloud deployment or secrets.
- Step 8 (ignore rules): when the v2 rule `/.bdk/` goes, every untracked path under `.bdk/` that is not BDK's own (`.bdk/tmp/`, v2 paths kept) gets an ignore entry of its own, named in the report; nothing is deleted.
- New eval cases: `setup-node-wrapper` (Node + Playwright, a budget wrapper, a suite-owned server, a hook, a deploying `build`, a tool to leave out), `setup-java-cypress` (Maven + Cypress through a wrapper, an E2E profile, a load test to leave out), and `explore-project-map` for the block.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `bdk-setup`: the explore step and its block, the setup model, wrapper scripts, the report line for left-out tools, the E2E entry of a suite that owns its server, untracked `.bdk/` content, and the eval cases.

## Resolved from "To resolve in the spec"

- **The explorer brief and where the map lives:** the brief is the skill `explore-project` (design D1, D2); the map is `.bdk/runs/setup/project-map.md`, a run file ignored with `.bdk/runs/` and rewritten on every setup run that detects (D3).
- **How setup records a left-out tool:** in the report only, one line per tool with its reason and source; `.bdk/settings.yaml` holds settings, not comments about tools it does not run (D5).

## Out of scope

- Other skills reading the project map (`/bdk:e2e-check`, `/bdk:explore`): no measurement asks for it yet.
- A CLI helper for exploration (CLAUDE.md, "Building skills (v3)").

## Impact

- `plugins/bdk/skills/explore-project/` (new), `plugins/bdk/skills/setup/` (SKILL.md, `references/stacks.md`, `references/e2e.md`), `plugins/bdk/agents/explorer.md` (description names both blocks), `plugins/bdk/evals/` (three cases, two fixtures, README).
- User docs: `docs/guide/first-run.md` (what setup does), `docs/concepts/orchestrators.md` (the `/bdk:setup` diagram redrawn with the explore step), `docs/concepts/agents.md` (the explorer runs two blocks: diagram and table), `docs/concepts/e2e.md` (a suite that owns its server), `docs/guide/footprint.md` (setup's run file and the extra ignore entries); Reference regenerated (`docs/reference/bdk/`).
- Cost: a setup run now spends an `opus` main thread and one `sonnet` explorer run; setup runs once per project.

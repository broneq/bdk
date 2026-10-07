# Proposal

## Why

Tracks #207.

The v3 architecture lists `bdk-craft` as its own plugin of craft knowledge skills, "each admitted by a with/without eval" (`docs/design/2026-10-07-v3-architecture.md`, section "Plugins"; ADR-0002 for the layout; ADR-0003 for "a new skill starts as a plain skill with an eval"). The repository holds no craft skill yet. The first attempt measured nine candidates with a custom harness and one run per cell (`docs/v3-draft1/evals/V3-EVAL-CRAFT.md`); that harness is gone, so v3.0 needs its own evidence from `claude plugin eval` before any craft skill ships.

## What Changes

- New plugin `plugins/bdk-craft/`: manifest, `README.md`, `skills/` and `evals/` only. No `package.json`, no CLI, no hooks, no agents.
- Eight candidate skills rewritten with `/skill-creator`, from the draft skills as reading material: `tdd`, `debugging`, `refactoring`, `testing-strategy`, `api-design`, `oop-design`, `modularizing`, `mermaid-drawer`. `data-modeling` is not a candidate: the draft measured it as no effect.
- Eval cases per candidate under `plugins/bdk-craft/evals/<skill>-<case>/` in the `claude plugin eval` format, written before the skill text, with scaffolded workspaces for the skills that change how code is written.
- A with/without run of every candidate. A candidate ships only when it passes the admission rule (design D3); a rejected one is deleted from `skills/` with its cases, and its numbers stay in the record.
- `plugins/bdk-craft/evals/RESULTS.md`: the admission record (per case and per skill `WITH`, `W/OUT`, `Δ`, the skill-fired rate, cost, model, verdict).
- Release and install wiring in the same PR: `release-please-config.json`, `.release-please-manifest.json`, and a `bdk-craft` entry in `.claude-plugin/marketplace.json` (`git-subdir`, `plugins/bdk-craft`, `ref: release`).
- A workspace test that ties `skills/`, `evals/` and `RESULTS.md` together, so a skill without admission evidence fails `pnpm test`.

**To resolve in the spec - which craft skills ship in v3.0:** the skills whose rows in `RESULTS.md` read `admitted` under rule D3. The candidate set and the rule are fixed here; the final list is the measured outcome, recorded in `RESULTS.md` and in design.md "Outcome".

## Capabilities

### New Capabilities
- `craft-skills`: the `bdk-craft` plugin - what it ships, how a craft skill is admitted by a with/without eval and how that evidence is recorded and checked. Its release and install wiring follows `repo-sdlc` and `marketplace`.

### Modified Capabilities
None. `repo-sdlc` already requires every plugin directory to be a release component, and `marketplace` requires the `git-subdir` entry at `ref: release`; this Change follows both without changing them.

## Impact

- New: `plugins/bdk-craft/**`, `tests/craft-skills.test.ts`.
- Changed: `release-please-config.json`, `.release-please-manifest.json`, `.claude-plugin/marketplace.json`, `CLAUDE.md` ("Current state"). `.gitignore` already ignores `plugins/*/evals/results/` (#189).
- Paid model calls, local only (`docs/design/2026-10-07-v3-repo-structure-cicd.md`, "Docs and evals"): one with/without run of the candidate suite.
- Out of scope: the `bdk` core plugin and any use of craft skills by `bdk` orchestrators (#178 and later block issues); `git-identity` and `bdk-skill-kit` (#175); the release-please setup itself (#173); the docs site (#212); the B1 speed fixture (#208).

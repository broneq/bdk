# Proposal

## Why

Tracks #197.

A BDK run starts every Change with a proposal: `/bdk:run` resume row 1 sends a Change with no OpenSpec Change directory or no `proposal.md` to the stage `propose` (spec `bdk-cli/run`), and the design stage reads the proposal's capabilities (design section "Catalog", orchestrators: `/bdk:propose`, intent or GitHub issue, `openspec new change`, output `proposal.md` with capabilities). The `bdk` plugin has the BDK OpenSpec schema (#180) and `/bdk:setup` installs it (#181), but no skill opens a Change, so no stage after it can run.

## What Changes

- New skill `plugins/bdk/skills/propose/` (`/bdk:propose`), built with `/skill-creator` as a plain skill with eval cases (CLAUDE.md "Building skills (v3)"). It runs in the main thread and, from an intent or a GitHub issue:
  - stops with "BDK not configured: run /bdk:setup" in a project without a valid BDK configuration (design "Constraints & NFRs", "Without configuration");
  - reads the issue with `gh issue view`, or takes the intent as written;
  - names the Change, runs `openspec new change <name> --schema bdk`, and writes `proposal.md` from the schema's own instruction and template (`openspec instructions proposal`), with capabilities checked against the project's main specs;
  - asks only what the issue or intent cannot settle, following `policy.questions` (`stop` asks the user, `decide-and-record` decides and records the decision);
  - ends with the Change name, the proposal path, its capabilities and the next stage.
- Eval cases `plugins/bdk/evals/propose-*` (`block`): an issue becomes a proposal (the issue's acceptance signal), an intent becomes a proposal, and an unconfigured project stops. A shared fixture `evals/fixtures/tiny-ledger-bdk.sh` builds the `tiny-ledger` project configured for BDK, with a main spec, for cases of blocks that need a configured project.
- An offline `gh` stand-in for eval runs, `plugins/bdk/evals/fixtures/bin/gh`. Recorded problem (probe for this Change, Claude Code 2.1.292): an eval run has its own `HOME` and passes no `GH_TOKEN`, so `gh issue view` fails with "To get started with GitHub CLI, please run: gh auth login" and no case can read an issue. The stand-in answers `gh issue view` from issue files the case scaffold writes; the eval README puts it first on `PATH` for the cases that read issues.

## Capabilities

### New Capabilities

- `bdk-propose`: the `/bdk:propose` skill: its inputs (intent, GitHub issue), the configuration check, naming and opening the Change with the BDK schema, the proposal it writes, questions under `policy.questions`, an existing Change, its report and its eval cases.

### Modified Capabilities

- `skill-evals`: a new requirement for the offline `gh` stand-in that cases reading GitHub issues use.

## Out of scope

- The design stage and its blocks `explore`, `design-draft`, `verify-design` (#190), which read the proposal and write `specs/` and `design.md`.
- Branches and pull requests: every Change branches from the base branch and gets its PR at close (skills decisions D9; `/bdk:close` #202, `/bdk:run` #203). Propose creates no branch and commits nothing.
- Queueing several issues and choosing the next Change (`/bdk:run`, #203).
- Writing to GitHub: propose reads an issue and never comments on it, labels it or creates one (skills decisions D3: BDK creates no GitHub issue without the user).
- Any new `bdk` command: no eval or measurement showed a need (CLAUDE.md "Building skills (v3)").

## Impact

- New: `plugins/bdk/skills/propose/SKILL.md`, `plugins/bdk/evals/propose-*/`, `plugins/bdk/evals/fixtures/tiny-ledger-bdk.sh`, `plugins/bdk/evals/fixtures/bin/gh`.
- Shared: `plugins/bdk/evals/README.md` (how to run cases that read issues), spec `skill-evals`, the plugin list of skills in `CLAUDE.md` "Current state".
- Ships in the released `bdk` plugin (`skills/`); `evals/` does not ship.
- No change to the `bdk` CLI, `package.json`, the lockfile or shared configuration.

# Proposal

## Why

Tracks #189.

ADR-0003 makes an eval the entry ticket of every v3 skill: a block stays only when it changes the outcome, and a helper, hook or workflow comes only for a problem an eval or a measurement showed. The design section "Evals and the development rule" of `docs/design/2026-10-07-v3-architecture.md` fixes the tool (`claude plugin eval`, with and without the plugin) and ADR-0002 fixes where cases live (`plugins/<name>/evals/`) and that paid evals never run in CI. What does not exist yet is the suite itself: the layout of cases, how fixtures are shared between blocks, how a contributor runs it, and proof that a case really reports the difference the plugin makes. Every block issue after this one needs that ground before its first case.

## What Changes

- A `plugins/bdk/evals/` suite for `claude plugin eval`: one directory per case named `<block>-<case>`, shared fixture scripts under `evals/fixtures/` that a case's `scaffold_script` runs, and `results/` ignored by git.
- One sample case, `sample-handover-note`, with its own small plugin inside the case directory, a shared fixture repository, and one grader of each kind the design names (`file_exists`, `regex` over a produced file, `tool_order`, `llm`, plus the `tool_used: Skill` indicator). It shows a with/without difference before any real block exists.
- A `pnpm run eval` script in `plugins/bdk` that builds the plugin and runs the suite with the pinned Claude Code version, and `plugins/bdk/evals/README.md`: how to run locally, how to write a block case and an orchestrator case, how fixtures are shared, cost, and the host facts measured while building this (bin path, Bash sandbox on macOS).
- A free test in PR CI that runs every fixture and every case scaffold the way the harness does and checks each case's layout, so a broken fixture fails in CI instead of zeroing a paid run. No paid eval runs in CI.

## Capabilities

### New Capabilities

- `skill-evals`: how the skills of the `bdk` plugin are measured - suite layout, case naming, shared fixtures, grader conventions for blocks and orchestrators, local runs, and the free CI check of fixtures.

### Modified Capabilities

None. The release snapshot already leaves `evals/` out (`plugin-release`, `scripts/publish-plugin.ts` `DEV_ONLY`).

## Impact

- New: `plugins/bdk/evals/` (README, `fixtures/tiny-ledger.sh`, `sample-handover-note/`), `plugins/bdk/tests/evals.test.ts`, spec `openspec/specs/skill-evals/`.
- Changed: `plugins/bdk/package.json` (one script, no dependency), `.gitignore` (`plugins/*/evals/results/`), `CONTRIBUTING.md` (one pointer to the eval README).
- No change to `src/`, the CLI, `shared/`, the lockfile or CI workflows.
- Out of scope: eval cases of real blocks and orchestrators (each block's own issue), the B1-sized speed fixture (#208), evals of `bdk-craft` (#207, its own suite under `plugins/bdk-craft/evals/`), and how skills call the `bdk` CLI (the design of the first block that calls it).

# Proposal

## Why

Tracks #183.

The implementer, the conformer and the review-round lead all need the project's checks run, and each needs the result in a file it can read back after a break (architecture "Execute", "Review round", "Run state, run artifacts and resume": `<change>/checks/<id>.json`, written by `bdk check run`). Draft 1 measured what happens when agents run checks themselves (`docs/v3-draft1/run-b1/2026-10-07-bdk-v3-findings.md`):

- "Agents for work that takes seconds": 46 haiku runner runs of about 1.1 min and 670 k cache-read tokens each, to run `vitest` and `eslint`.
- "Parallel tasks share one tree and one check file": checks of one ticket cited another ticket's run.
- "Commands hang on stdin": 14 commands hit the 120 s timeout; one shell stayed alive 93 min.

A deterministic command that runs the configured `tools.*` commands with stdin closed and a timeout, writes one result file per caller-chosen id, and appends red checks to the round's findings log answers all three without an agent and without bookkeeping (ADR-0003; architecture "CLI": `bdk check run [--scope]`).

## What Changes

- New command group `bdk check` with one command (`plugins/bdk/src/check/`):
  - `bdk check run <run-dir> <id> [--scope <path>]... [--kind <test|lint|build>]... [--round <n>]` runs the configured `tools.test`, `tools.lint` and `tools.build` entries one after another in the project root, scoped (each entry's `scoped` with `{files}` filled from `--scope`) or full, with stdin closed and a timeout per command; writes each command's output to `<run-dir>/checks/<id>/<kind>-<tool>.txt` and the result to `<run-dir>/checks/<id>.json`; with `--round <n>`, appends one finding per red check to `<run-dir>/review/round-<n>/findings.jsonl` through the `findings` slice. Exit 1 when a check is red.
- Result file schema (issue, "To resolve in the spec"): spec `bdk-cli/check`, "Result file"; decisions in design.md (D3).
- Timeout per command: a new optional `timeout` (seconds) on every `tools.test`, `tools.lint` and `tools.build` item; 600 when absent (design D5). Delta of `bdk-cli/config`, "Settings keys".
- Repeatable flags in the CLI frame: a command may declare a string flag `multiple`, given once per value (`--scope a.ts --scope b.ts`), so paths with spaces pass unchanged (design D2). Delta of `bdk-cli`.
- New OS boundary `plugins/bdk/src/shared/shell/`: runs one command through `/bin/sh -c` with stdin closed, stdout and stderr into one file, and kills its process group at the timeout.

## Capabilities

### New Capabilities

- `bdk-cli/check`: the `bdk check` command group - `run`, the result file, the output files, the findings it appends, and its errors.

### Modified Capabilities

- `bdk-cli`: Requirement "Invocation and routing" gains repeatable flags; "Help" shows them.
- `bdk-cli/config`: Requirement "Settings keys" gains the `timeout` field of `tools.test`, `tools.lint` and `tools.build` items (the spec allows the task that builds a key's consumer to change its row).

## Impact

- Code: `plugins/bdk/src/check/` (new slice), `plugins/bdk/src/shared/shell/` (new OS boundary), `plugins/bdk/src/shared/cli/` (repeatable flags), `plugins/bdk/src/config/domain/settings.ts` (`timeout`), `plugins/bdk/src/slices.ts`, `plugins/bdk/src/main.ts`, `CLAUDE.md` "Current state".
- Tests: unit tests of the slice against an in-memory file system and a fake shell; boundary tests against real `/bin/sh`; end-to-end tests of the built frame against a temporary project.
- Callers: the `run-checks` block skill, `implement-part`, `conform-part` and the review-round lead (architecture "Catalog") call it; none exists yet, so nothing calls it in this Change.
- Out of scope: `/bdk:setup`, which detects and writes the `tools.*` commands (#181); the review skills that read the findings; `tools.e2e` (the `e2e-check` block); deciding what to do with a red check, which stays in skill text.

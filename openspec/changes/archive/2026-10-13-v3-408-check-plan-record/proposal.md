## Why

Tracks #408. An agent runs a part's tests as `bdk check run <run-dir> 02-red2 --at part --kind test --scope <file>`, so its transcript shows only that wrapper: not the command from `.bdk/settings.yaml`, its working directory, its output or its exit code. On a project whose hook allows only its own test wrapper (with a machine-wide spec budget), a second wrapper on top made a slow or hung run impossible to diagnose from the transcript. Separately, the part check takes its files from `--changed HEAD`, so what runs follows what changed, not what should be tested: a change to `src/checkout.ts` skips `e2e/checkout.spec.ts`.

The user chose the direction on a Lavish review page (2026-10-13): the working agent runs each command itself, `bdk` only resolves and records, and the agent picks the test files (design D1, D2, D5).

## What Changes

- **BREAKING** `bdk check run` goes. Two verbs replace it:
  - `bdk check plan <run-dir> <id> [--at] [--changed] [--scope]... [--tests]... [--kind]...` selects the items exactly as `check run` did, runs nothing, writes `checks/<id>/plan.json` and prints, per item, the line to run (`<command> </dev/null > <output file> 2>&1`) and the Bash timeout of that call.
  - `bdk check record <run-dir> <id> [--round <n>]` takes each item's exit code from the agent (`--exit <kind>-<tool>=<code>`, `--timed-out <kind>-<tool>`), marks an item without one `not-run`, and writes `checks/<id>.json` (`version: 3`, with each check's working directory) and, with `--round`, the findings, as `check run` did.
- The agent that needs the check (`bdk:implementer`, `bdk:conformer`, `bdk:lead`) runs each printed line as its own Bash call, so the transcript shows the real command and the tool reports its exit code; `record` prints the tail of each red check. No runner agent and no background mode is added.
- **BREAKING** `--tests <path>` (repeatable) gives `tools.test` items the test files the agent picked; with it, test items no longer take files from `--changed` or `--scope`, which stay the files of lint and build items. A test item with no picked file is skipped, so a part with no E2E spec runs no E2E suite.
- `/bdk:implement-part`, `/bdk:conform-part` and `/bdk:resolve-conflict` say how to pick the tests of a check (the acceptance tests, the existing tests of the touched modules, the E2E specs of the touched flows) and name the picked files in their report; `/bdk:execute-waves` and `/bdk:review-round` run the wave and review checks through `plan` and `record`.
- `/bdk:setup` adds the allow rule `Edit(.bdk/runs/**)`, so the line's redirect passes in the default permission mode, and `env.BASH_MAX_TIMEOUT_MS` when an item's `timeout` exceeds the Bash tool's 600 s (design D3, D4; both measured).
- The CLI's shell runner (`src/shared/shell/`) goes with `check run`; the Bash tool's timeout replaces its process-group kill (design D4).
- The spec `bdk-cli/check` writes down what the old wrapper did: one `/bin/sh -c` process per item, one after another, no concurrency, output only to the file and a 20-line tail on stdout, exit 1 for any red check instead of the command's code, and an `<id>` such as `02-red2` that is any kebab-case name the caller picks.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `bdk-cli/check`: "Run the checks" becomes "Plan the checks" and "Record the checks"; output files gain the run's exit line from the agent's call; the result file moves to `version: 3` with `cwd` and a `not-run` status; text output and errors follow; `--tests` routes picked test files.
- `bdk-cli/config`: the `tools.*` row names `bdk check plan` and `--tests` instead of `bdk check run`.
- `bdk-execute-blocks`: the red run, the part check, the conform check and the merge check run through `plan`, the agent's own Bash calls and `record`, on picked test files; the report names the picked tests; the limits name the printed lines as the only check commands.
- `bdk-execute`: the wave check runs through `plan` and `record` in the lead.
- `bdk-auto-review`: the review check of a round runs through `plan` and `record` in the lead.
- `bdk-setup`: the allow rules gain `Edit(.bdk/runs/**)` and `env.BASH_MAX_TIMEOUT_MS` for long items; the `paths` requirement names `bdk check plan` and the picked test files.
- `docs-site`: the Concepts page of the orchestrators names the check runs of execute by `bdk check plan` and `record`.

## Impact

- Code: `plugins/bdk/src/check/` (commands `plan` and `record`, plan and result schemas, render), `plugins/bdk/src/shared/shell/` removed, `plugins/bdk/src/main.ts` wiring, `plugins/bdk/tests/check.test.ts`.
- Skills: `implement-part`, `conform-part`, `resolve-conflict`, `execute-waves`, `review-round`, `cli`, `diagnose-run` (names the check run), `setup` and `setup/references/stacks.md`; their eval cases where they grade a `check run` call.
- Users: a skill or script that calls `bdk check run` fails with an unknown command; `.bdk/settings.yaml` is unchanged. The real test commands now appear as Bash calls of the agents, so the permission rules `/bdk:setup` already writes for each command apply to them.
- Docs: Guide -> Configuration (`docs/guide/configuration.md`), Guide -> Footprint (`docs/guide/footprint.md`), Concepts -> Orchestrators (`docs/concepts/orchestrators.md`, its execute and review diagrams), Concepts -> CLI, config and hooks (`docs/concepts/cli-config-hooks.md`), Concepts -> Findings (`docs/concepts/findings.md`), Concepts -> Run state (`docs/concepts/run-state.md`), Concepts -> Stages (`docs/concepts/stages.md`), and the Reference regenerated.
- Out of scope: building in the main checkout without part worktrees (#406, which edits the same skills; whichever merges second rebases); host contention of heavy suites stays the project's (v3-317-test-groups).

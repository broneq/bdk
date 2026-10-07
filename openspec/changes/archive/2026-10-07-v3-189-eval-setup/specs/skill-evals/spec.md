# Spec Delta

## Purpose

Defines how the skills of the `bdk` plugin are measured with `claude plugin eval`: where cases and shared fixtures live, how block and orchestrator cases are graded, how a contributor runs the suite, and what PR CI checks for free.

## ADDED Requirements

### Requirement: Suite layout

The eval cases of the `bdk` plugin SHALL live under `plugins/bdk/evals/`, one directory per case named `<block>-<case>` in kebab-case, where `<block>` is the name of the skill the case measures. Directories that are not cases SHALL be only `fixtures/` and `results/`. Run results under `plugins/*/evals/results/` SHALL be ignored by git, and the released plugin SHALL hold no `evals/` directory.

#### Scenario: Case names

- **WHEN** the directories directly under `plugins/bdk/evals/` other than `fixtures/` and `results/` are listed
- **THEN** each name is kebab-case with at least two segments, and each holds a `prompt.md` or a `case.yaml`

#### Scenario: Results are not committed

- **WHEN** a run writes `plugins/bdk/evals/results/<timestamp>/` and `git status` runs
- **THEN** no path under it is listed

### Requirement: Shared fixtures

A fixture used by more than one case SHALL be a script `plugins/bdk/evals/fixtures/<name>.sh` that builds a workspace in its current directory from files and git state only, with no network access, and exits 0 within 120 seconds. A case SHALL use it from its own `scaffold_script` by a path relative to that script, and SHALL NOT keep a copy of it.

#### Scenario: Fixture runs alone

- **WHEN** a fixture script runs in an empty directory with only `PATH`, a temporary `HOME` and `TMPDIR`, and `TERM=dumb` set
- **THEN** it exits 0 within 120 seconds and the directory is no longer empty

#### Scenario: Case scaffold reuses a fixture

- **WHEN** a case's `scaffold_script` runs from the case directory's path in an empty workspace
- **THEN** it builds the workspace through the shared fixture script and exits 0

### Requirement: Block and orchestrator cases

A case of a block SHALL carry the tag `block`, run with and without the plugin, and hold at least one grader on the result (`file_exists`, `regex` or `llm`) and one on the steps (`tool_used` or `tool_order`). A case of an orchestrator SHALL carry the tag `orchestrator` and is run with `--ablation none`; it SHALL hold `tool_order` graders for the order of its blocks and `file_exists` graders for the files the run writes. Every case SHALL carry exactly one of the tags `block`, `orchestrator` or `sample`.

#### Scenario: Block case graders

- **WHEN** a case tagged `block` is loaded
- **THEN** it has a grader of type `file_exists`, `regex` or `llm`, and a grader of type `tool_used` or `tool_order`

#### Scenario: Orchestrators run one arm

- **WHEN** a contributor runs the orchestrator cases as the eval README says
- **THEN** the command filters on the tag `orchestrator` and passes `--ablation none`

### Requirement: Sample case reports the plugin's difference

The suite SHALL hold the case `sample-handover-note`, tagged `sample`, that measures a skill of a plugin kept inside the case directory and never released, builds its workspace from a shared fixture, and uses `file_exists`, `regex`, `tool_order`, `llm` and `tool_used` graders. Run with and without its plugin, the case SHALL report a with-arm score above the without-arm score.

#### Scenario: Difference is reported

- **WHEN** `pnpm --filter @bdk/bdk run eval --allow-tools Write --case 'sample-*'` runs with credentials
- **THEN** the summary shows `WITH`, `W/OUT` and a positive `Δ` for `sample-handover-note`

### Requirement: Local run

`pnpm --filter @bdk/bdk run eval` SHALL build the plugin and run its suite with the Claude Code version pinned in the root `devDependencies`, running case scaffolds, and SHALL pass further arguments to `claude plugin eval`. `plugins/bdk/evals/README.md` SHALL say how to run the suite, how to probe cheaply, how to grant tools, how to write a block case, an orchestrator case and a shared fixture, and the host limits a case author meets.

#### Scenario: Arguments pass through

- **WHEN** a contributor runs `pnpm --filter @bdk/bdk run eval --case 'sample-*' --runs 1`
- **THEN** only `sample-handover-note` runs, once per arm

### Requirement: No paid evals in CI, free checks of the suite

No CI workflow SHALL start a paid eval run. PR CI SHALL load every case of `plugins/bdk/evals/` with the pinned Claude Code loader at a cost ceiling of zero and fail on a case that does not load or a grader that cannot pass with the tools the README grants, and SHALL run every shared fixture and every case scaffold as the harness runs them and fail on a non-zero exit. The check SHALL prove that it detects a broken case, so a change in the loader's output cannot turn it into a silent pass.

#### Scenario: Broken case fails CI

- **WHEN** a case under `plugins/bdk/evals/` has an unknown frontmatter key and `pnpm test` runs
- **THEN** the eval suite test fails and names the case

#### Scenario: Broken fixture fails CI

- **WHEN** a shared fixture or a case scaffold exits non-zero and `pnpm test` runs
- **THEN** the eval suite test fails and names the script

#### Scenario: No credentials needed

- **WHEN** the check runs with an empty `HOME` and no model credentials
- **THEN** it completes without a model call and without cost

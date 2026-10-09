# bdk-plan Specification

## Purpose
Defines the `/bdk:plan` orchestrator of the `bdk` plugin: how it composes `plan-draft`, `bdk plan check` and `verify-plan` into a loop that ends at a passing plan or at the verifier budget, when it stops before spending a verifier pass, and how it resumes from run files.

## Requirements

### Requirement: Configured project and a designed Change

`/bdk:plan` SHALL be a skill of the `bdk` plugin (`plugins/bdk/skills/plan/`). It SHALL read the configuration with `bdk config show` before anything else. When the project is not configured or the configuration is invalid, it SHALL stop, run no block, write no file, and pass on the line `bdk config show` printed. It SHALL take the name of an OpenSpec Change as its argument; without one it SHALL use the only active Change under `openspec/changes/`, and when there are several or none it SHALL name what it found and stop without running a block. When the Change has no `proposal.md`, no spec delta under `specs/` or no `design.md`, or when the last design report `.bdk/runs/<change>/design/verify-N.md` (highest N) does not pass, it SHALL stop without running a block and name `/bdk:design <change>` as the stage to run first.

#### Scenario: Project without BDK

- **WHEN** `/bdk:plan add-csv-export` runs in a project without `.bdk/settings.yaml`
- **THEN** the reply says `BDK not configured: run /bdk:setup`, no agent is started, and no file under `openspec/` or `.bdk/` is created

#### Scenario: Change without a design

- **WHEN** `/bdk:plan add-csv-export` runs and the Change has a proposal but no `design.md`
- **THEN** no block runs and the reply names `/bdk:design add-csv-export` as the stage to run first

#### Scenario: Design failed its last check

- **WHEN** `/bdk:plan add-csv-export` runs and `.bdk/runs/add-csv-export/design/verify-1.md` says `Verdict: FAIL`
- **THEN** no block runs and the reply names `/bdk:design add-csv-export`

### Requirement: The orchestrator only composes the plan blocks

The skill SHALL run `plan-draft` as a `bdk:planner` agent whose prompt runs the skill `bdk:plan-draft`, `bdk plan check` on the Change's `plan/parts/` before every verifier pass, and `verify-plan` as a `bdk:verifier` agent whose prompt runs the skill `bdk:verify-plan`. Each agent SHALL get `model` and `effort` from `models.planner` or `models.verifier` as spec `bdk-cli/config` ("Every agent is a models role") says. It SHALL NOT write, fix or check a plan part itself, and SHALL write no file. It SHALL NOT commit, create a branch or start the execute stage.

#### Scenario: Full plan of a designed Change

- **WHEN** `/bdk:plan add-csv-export` runs for a Change that has a proposal, a spec delta and a design, and no plan parts
- **THEN** a `bdk:planner` agent starts before a `bdk:verifier` agent starts, `bdk plan check` runs on `openspec/changes/add-csv-export/plan/parts` before the verifier starts, and `openspec/changes/add-csv-export/plan/parts/01.md` and `.bdk/runs/add-csv-export/plan/verify-1.md` exist

### Requirement: Resume from the run files

The skill SHALL start at the first missing or open step, reading the plan parts and the plan reports of the Change: without a part under `plan/parts/` it SHALL start with `plan-draft`; with parts and without a `plan/verify-N.md` it SHALL start with `bdk plan check` and a verifier pass; when the last report (highest N) says `Verdict: FAIL` it SHALL start with `plan-draft` fixing that report; when the last report passes it SHALL run no block and report that the plan passed. A step whose file exists SHALL NOT run again.

#### Scenario: Failed report waiting for a fix

- **WHEN** `/bdk:plan add-csv-export` runs and the last report `plan/verify-1.md` says `Verdict: FAIL`
- **THEN** `plan-draft` fixes the parts before a `bdk:verifier` agent starts, and the next report is `plan/verify-2.md`

#### Scenario: Plan already passed

- **WHEN** `/bdk:plan add-csv-export` runs and the last report `plan/verify-1.md` says `Verdict: PASS`
- **THEN** neither `plan-draft` nor a `bdk:verifier` agent runs, and the reply says the plan passed and names `/bdk:execute add-csv-export` as the next stage

### Requirement: Check before every verification

Before each verifier pass the skill SHALL run `bdk plan check` on the parts. The call SHALL be the whole Bash command, written as `${CLAUDE_PLUGIN_ROOT}/bin/bdk plan check <parts dir>` with no quotes around the path and no `cd`, `;`, `&&` or `echo` around it, so that the grant `Bash(${CLAUDE_PLUGIN_ROOT}/bin/bdk *)` matches it and the stage is not stopped by a denied call. On exit 1 it SHALL run `plan-draft` once to clear the listed problems and check again; when the check still exits 1, it SHALL stop before the verifier and report the problems. On exit 3 it SHALL stop and pass the message on.

#### Scenario: Problems plan-draft cannot clear

- **WHEN** `bdk plan check` exits 1 before a pass and still exits 1 after `plan-draft` ran on its problems
- **THEN** no `bdk:verifier` agent starts for that pass and the reply lists the problems

#### Scenario: Check call under a narrow grant

- **WHEN** `/bdk:plan` runs on plan parts that were never checked and the run grants only `Bash(*/bin/bdk *)`
- **THEN** the check call is not denied and a `bdk:verifier` agent starts after it

### Requirement: Gaps of the design stop the plan

When `plan-draft` names a gap of the design (a choice that changes what the product does, left open by the specs and the design), the skill SHALL stop before the verifier, report the gap, and name `/bdk:design <change>` as the stage that answers it.

#### Scenario: Gap named by plan-draft

- **WHEN** `plan-draft` replies that the design leaves open what the export command does on an unknown subcommand
- **THEN** no `bdk:verifier` agent starts and the reply names the gap and `/bdk:design add-csv-export`

### Requirement: Verify loop within the budget

After each `Verdict: FAIL` report, the skill SHALL run `plan-draft` to fix it, check the parts, and verify again, continuing the same `bdk:verifier` agent with `SendMessage` when it has that agent's ID and the tool, and otherwise starting a new `bdk:verifier` agent. One run of the skill SHALL start at most `policy.budgets.verifier` verifier passes. When the last allowed pass fails, the skill SHALL stop, run no further `plan-draft`, and report the last report's path, its open `Must address` IDs, and that `/bdk:plan <change>` continues from there.

#### Scenario: Fixed within the budget

- **WHEN** the first report fails with `M1` and the fixed plan passes
- **THEN** `plan/verify-2.md` starts with `Verdict: PASS` and names `M1` under `Closed:`

#### Scenario: Budget spent

- **WHEN** `policy.budgets.verifier` is 1 and the first report says `Verdict: FAIL`
- **THEN** no second `bdk:verifier` pass starts, `plan-draft` does not run after the report, and the reply names `plan/verify-1.md`, its `Must address` IDs and `/bdk:plan add-csv-export`

### Requirement: Report

The skill SHALL say, before each block runs, which block runs and which file it writes. It SHALL end with a short report: the part files, the waves and the number of waves from `bdk plan check`, the last verdict and the number of verifier passes used, the choices `plan-draft` made inside the design's frame, and, after a passing report, the next stage `/bdk:execute <change>`.

#### Scenario: Report after a passed plan

- **WHEN** the plan of `add-csv-export` passed in this run
- **THEN** the reply names the part files, the waves, the last `plan/verify-N.md` with its verdict, and `/bdk:execute add-csv-export` as the next stage

### Requirement: Orchestrator eval cases

`plugins/bdk/evals/` SHALL hold cases of `/bdk:plan` tagged `orchestrator`, built on the shared ledger fixture: a full plan of a designed Change, a resume from a failed report, a spent budget, and plan parts written without `plan-draft`. Each SHALL hold `tool_order` graders for the order of the blocks or trace graders for blocks that must not run, and `file_exists` graders for the files the run writes, and their results SHALL be recorded in the Change.

#### Scenario: Orchestrator cases pass

- **WHEN** `pnpm --filter @bdk/bdk run eval --tag orchestrator --case 'plan-*' --ablation none` runs with the grants of the eval README
- **THEN** every `tool_order` and `file_exists` grader of the `plan-*` orchestrator cases passes

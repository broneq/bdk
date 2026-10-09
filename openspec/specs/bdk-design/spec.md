# bdk-design Specification

## Purpose

Defines the `/bdk:design` orchestrator of the `bdk` plugin: how it composes the design blocks `explore`, `design-draft` and `verify-design` into a loop that ends at a passing design or at the verifier budget, how it resumes from run files, and how the design gate set by `policy.gates.design` approves the design.

## Requirements

### Requirement: Configured project and an opened Change

`/bdk:design` SHALL be a skill of the `bdk` plugin (`plugins/bdk/skills/design/`). It SHALL read the configuration with `bdk config show` before anything else. When the project is not configured, it SHALL stop, run no block, write no file, and pass on `BDK not configured: run /bdk:setup`. It SHALL take the name of an OpenSpec Change as its argument; without one it SHALL use the only active Change under `openspec/changes/`, and when there are several or none it SHALL name what it found and stop without running a block. When the Change has no `proposal.md`, it SHALL stop without running a block and name `/bdk:propose` as the stage to run first.

#### Scenario: Project without BDK

- **WHEN** `/bdk:design add-csv-export` runs in a project without `.bdk/settings.yaml`
- **THEN** the reply says `BDK not configured: run /bdk:setup`, no agent is started, and no file under `openspec/` or `.bdk/` is created

#### Scenario: Change without a proposal

- **WHEN** `/bdk:design` runs and the only active Change has no `proposal.md`
- **THEN** no block runs and the reply names `/bdk:propose` as the stage to run first

### Requirement: The orchestrator only composes the design blocks

The skill SHALL run the design blocks in this order: `explore` as a `bdk:explorer` agent, `design-draft` as a `bdk:designer` agent whose prompt runs the skill `bdk:design-draft`, and `verify-design` as a `bdk:verifier` agent whose prompt runs the skill `bdk:verify-design`, each agent with `model` and `effort` from `models.explorer`, `models.designer` or `models.verifier` as spec `bdk-cli/config` ("Every agent is a models role") says. When the designer ends with open questions, the skill SHALL ask them as spec `design-blocks` ("Questions follow the policy and the session") says and pass the answers back to the designer. It SHALL NOT map the code, write or fix a spec delta or `design.md`, or check the design itself. The only file it SHALL write is the gate file `.bdk/runs/<change>/design/gate.md`. It SHALL NOT commit, create a branch or start the plan stage.

#### Scenario: Full design of a fresh Change

- **WHEN** `/bdk:design add-csv-export` runs for a Change that has a `proposal.md` and no run files, with `policy.questions: decide-and-record` and `policy.gates.design: auto`
- **THEN** a `bdk:explorer` agent starts before a `bdk:designer` agent starts, the designer starts before a `bdk:verifier` agent starts, and `.bdk/runs/add-csv-export/design/explore.md`, `openspec/changes/add-csv-export/design.md`, the spec delta and `.bdk/runs/add-csv-export/design/verify-1.md` exist

#### Scenario: Models of the design agents

- **WHEN** `/bdk:design add-csv-export` runs for a fresh Change with `models.explorer.model: sonnet`, `models.designer.effort: high` and `models.verifier.model: sonnet`
- **THEN** the `bdk:explorer` agent and the `bdk:verifier` agent both start with `model` `sonnet`, and the `bdk:designer` agent starts with `effort` `high`

### Requirement: Resume from the run files

The skill SHALL start at the first missing or open step, reading the run files of the Change: without `.bdk/runs/<change>/design/explore.md` and without `design.md` it SHALL start with `explore`; without `design.md` it SHALL start with `design-draft`; without a `design/verify-N.md` it SHALL start with `verify-design`; when the last report (highest N) says `Verdict: FAIL` it SHALL start with `design-draft` fixing that report; when the last report says `Verdict: PASS` it SHALL go to the gate. When `design/gate.md` says `Gate: approved` and no report is newer than it names, it SHALL run no block and report that the design is approved. A step whose file exists SHALL NOT run again.

#### Scenario: Map already written

- **WHEN** `/bdk:design add-csv-export` runs and `.bdk/runs/add-csv-export/design/explore.md` exists without a `design.md`
- **THEN** no `bdk:explorer` agent starts and `design-draft` runs first

#### Scenario: Failed report waiting for a fix

- **WHEN** `/bdk:design add-csv-export` runs and the last report `design/verify-1.md` says `Verdict: FAIL`
- **THEN** no `bdk:explorer` agent starts, `design-draft` fixes the design before a `bdk:verifier` agent starts, and the next report is `design/verify-2.md`

### Requirement: Verify loop within the budget

After each `Verdict: FAIL` report, the skill SHALL run `design-draft` to fix it and SHALL verify again, continuing the same `bdk:verifier` agent with `SendMessage` when it has that agent's ID and the tool, and otherwise starting a new `bdk:verifier` agent. One run of the skill SHALL start at most `policy.budgets.verifier` verifier passes. When the last allowed pass fails, the skill SHALL stop before the gate, write no gate file, and report the last report's path and its open `Must address` IDs, and that `/bdk:design <change>` continues from there.

#### Scenario: Fixed within the budget

- **WHEN** the first report fails with `M1` and the fixed design passes
- **THEN** `design/verify-2.md` starts with `Verdict: PASS` and the skill goes to the gate

#### Scenario: Budget spent

- **WHEN** `policy.budgets.verifier` is 1 and the first report says `Verdict: FAIL`
- **THEN** no second `bdk:verifier` pass starts, no `design/gate.md` is written, and the reply names `design/verify-1.md` and its `Must address` IDs

### Requirement: Design gate by policy.gates.design

When the last report passes, the skill SHALL apply the design gate. With `policy.gates.design: auto` it SHALL approve the design without asking. With `manual` it SHALL ask the user to approve the design, naming `design.md`, the spec deltas and the decisions taken without the user, through `AskUserQuestion` with the options to approve or to request changes. A request for changes SHALL go to `design-draft` as a revision request, followed by a verifier pass within the same budget and the gate again. When `AskUserQuestion` is not available, the skill SHALL ask for approval in its reply and end its turn without writing the gate file. On approval it SHALL write `.bdk/runs/<change>/design/gate.md` whose first line is `Gate: approved`, followed by `By: user` or `By: policy.gates.design auto`, and `Report: design/verify-N.md` naming the passing report.

#### Scenario: Automatic gate

- **WHEN** the last report passes and `policy.gates.design` is `auto`
- **THEN** no question is asked and `design/gate.md` starts with `Gate: approved` and names `By: policy.gates.design auto`

#### Scenario: Manual gate without a way to ask

- **WHEN** the last report passes, `policy.gates.design` is `manual`, and `AskUserQuestion` is not available
- **THEN** the reply asks the user to approve the design and names `design.md`, and no `design/gate.md` is written

#### Scenario: Changes requested at the gate

- **WHEN** at a manual gate the user asks to quote every label
- **THEN** `design-draft` revises the design with that request, a verifier pass writes the next `design/verify-N.md`, and the gate asks again after it passes

### Requirement: Report

The skill SHALL say, before each block runs, which block runs and which file it writes. It SHALL end with a short report: the files written in this run, the last verdict and the number of verifier passes used, every decision `design.md` marks `Decided without the user:`, the gate's outcome, and, after an approval, the next stage `/bdk:plan <change>`.

#### Scenario: Report after an approved design

- **WHEN** the gate has approved the design of `add-csv-export`
- **THEN** the reply names `design.md`, the last `design/verify-N.md` with its verdict, `design/gate.md`, and `/bdk:plan add-csv-export` as the next stage

### Requirement: Orchestrator eval cases

`plugins/bdk/evals/` SHALL hold cases of `/bdk:design` tagged `orchestrator`, built on the shared ledger fixtures: a full design from a proposal with an automatic gate, a resume from a failed report, and a manual gate in a session that cannot ask. Each SHALL hold `tool_order` graders for the order of the blocks and `file_exists` graders for the files the run writes, and their results SHALL be recorded in the Change.

#### Scenario: Orchestrator cases pass

- **WHEN** `pnpm --filter @bdk/bdk run eval --tag orchestrator --case 'design-*' --ablation none` runs with the grants of the eval README
- **THEN** every `tool_order` and `file_exists` grader of the `design-*` cases passes

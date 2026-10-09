## ADDED Requirements

### Requirement: plan-draft runs in the planner agent

`plan-draft` SHALL run inside a `bdk:planner` agent. When the skill is invoked in any other thread, it SHALL start one `bdk:planner` agent with the prompt to run `bdk:plan-draft` with its arguments, `model` and `effort` from `models.planner` when set, wait for it, and pass on its reply; it SHALL NOT read the design or write a part itself.

#### Scenario: Invoked by the user

- **WHEN** the user runs `/bdk:plan-draft add-csv-export` in the main thread
- **THEN** a `bdk:planner` agent writes the parts and the main thread replies with the parts and the waves it reports

### Requirement: Planner agent

The `bdk` plugin SHALL ship the agent `bdk:planner` (`agents/planner.md`), which runs the skill `bdk:plan-draft` its prompt names with the `Skill` tool, with `model: inherit`, so that, with `models.planner` not set, the block runs on the session's model as it did in the main thread, and the tools `Read`, `Write`, `Edit`, `Bash`, `Grep`, `Glob` and `Skill`.

#### Scenario: Planner with model and effort

- **WHEN** `/bdk:plan add-csv-export` drafts the plan with `models.planner.model: sonnet` and `models.planner.effort: low`
- **THEN** a `bdk:planner` agent started with `model` `sonnet` and `effort` `low` writes `openspec/changes/add-csv-export/plan/parts/01.md`

## MODIFIED Requirements

### Requirement: plan-draft writes the parts

`plan-draft` SHALL read the proposal, every spec delta and the design of the Change, and the code they name, before it writes a part. It SHALL write the plan as `openspec/changes/<change>/plan/parts/NN.md`, in the part format of spec `bdk-openspec-schema` ("Plan parts are files with frontmatter"): frontmatter, `## Goal`, `## Acceptance scenarios` and `## Tasks` with the task contract lines `File:`, `Interface:` and `Verified by:`. It SHALL NOT change code, specs, the proposal or the design. A gap of the design SHALL be a choice about behaviour the Change adds or changes; behaviour no requirement of the Change touches SHALL NOT be named as a gap.

- Every scenario of the Change's spec deltas SHALL be named in the acceptance scenarios of exactly one part, as `<capability>` / `Requirement: <name>` / `Scenario: <name>`.
- Every path, function, command and type a task names as existing SHALL exist in the code as named.
- A part SHALL hold everything its implementer needs beyond the specs and the design: a fact several parts need is written into each of them, not into one part only.
- A `Verified by:` line SHALL name tests, spec scenarios or exact commands; it SHALL NOT name a set of commands by exclusion, nor a command that spends money, needs credentials or reaches a shared or external system.
- The tests of a task SHALL be in the same part as the code they test.

#### Scenario: Parts written

- **WHEN** `/bdk:plan-draft add-csv-export` runs on a Change with proposal, spec deltas and design and no plan
- **THEN** `openspec/changes/add-csv-export/plan/parts/01.md` exists with the frontmatter keys `id`, `depends-on`, `isolation` and `files`, and every task in it has the lines `File:`, `Interface:` and `Verified by:`

#### Scenario: Every scenario covered once

- **WHEN** the spec deltas of the Change hold six scenarios
- **THEN** each of the six is named in the acceptance scenarios of exactly one part

#### Scenario: Open product question

- **WHEN** the specs and the design leave open a choice that changes what the product does and the code does not settle it
- **THEN** `plan-draft` writes no part for that choice and the reply names the question as a gap of the design

#### Scenario: Behaviour outside the Change is not a gap

- **WHEN** the Change adds `ledger export <file>` and no requirement says what `ledger` does with no argument or an unknown subcommand
- **THEN** the reply names no gap for it, and no part plans or tests it

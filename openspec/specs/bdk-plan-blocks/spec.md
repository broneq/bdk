# bdk-plan-blocks Specification

## Purpose

Defines the two blocks of the plan stage that the `bdk` plugin ships: `plan-draft`, which writes a Change's plan parts, and `verify-plan`, which checks them against the code before execute, with their eval cases.

## Requirements

### Requirement: Blocks run only in a configured project

`/bdk:plan-draft` and `/bdk:verify-plan` SHALL each start from the output of `bdk config show`. When it reports `BDK not configured: run /bdk:setup` or an invalid configuration, the block SHALL write no file and SHALL end by passing that line on to the user.

#### Scenario: Project without configuration

- **WHEN** `/bdk:plan-draft add-csv-export` runs in a project without `.bdk/settings.yaml`
- **THEN** no file is written and the reply tells the user to run `/bdk:setup`

### Requirement: Change to plan

Both blocks SHALL take the name of an OpenSpec Change as their argument. Without an argument, a block SHALL use the only active Change under `openspec/changes/` that has `design.md`; when there are several, it SHALL write nothing and name them, asking which one. A Change without `proposal.md`, a spec delta or `design.md` SHALL make `plan-draft` stop and name what is missing; a Change without plan parts SHALL make `verify-plan` stop and name `/bdk:plan-draft`.

#### Scenario: One active Change

- **WHEN** `/bdk:plan-draft` runs without an argument and `add-csv-export` is the only active Change with `design.md`
- **THEN** it plans `add-csv-export`

#### Scenario: Design missing

- **WHEN** `/bdk:plan-draft add-csv-export` runs and the Change has no `design.md`
- **THEN** no part is written and the reply names the missing `design.md`

### Requirement: plan-draft writes the parts

`plan-draft` SHALL read the proposal, every spec delta and the design of the Change, and the code they name, before it writes a part. It SHALL read the rules `bdk rules for --stage plan` selects, without files, and follow them in how it cuts the parts and writes the tasks; a part or task that follows from a rule SHALL name the rule's id. It SHALL write the plan as `openspec/changes/<change>/plan/parts/NN.md`, in the part format of spec `bdk-openspec-schema` ("Plan parts are files with frontmatter"): frontmatter, `## Goal`, `## Acceptance scenarios` and `## Tasks` with the task contract lines `File:`, `Interface:` and `Verified by:`. It SHALL NOT change code, specs, the proposal or the design. A gap of the design SHALL be a choice about behaviour the Change adds or changes; a case a requirement of the Change reaches, whose possible answers give the user materially different results (an existing file that a new option writing one would overwrite or refuse), SHALL be such a behaviour even when no scenario names it; ordinary input handling the Change's error rules settle by analogy (a missing argument, a malformed value) and behaviour no requirement of the Change touches SHALL NOT be named as a gap. The reply SHALL list every gap under the heading `Gaps of the design`, also a gap it planned around.

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

#### Scenario: Unnamed case of a new requirement is a gap

- **WHEN** a requirement of the Change adds `ledger export <file> --out <path>` with a scenario for a new `<path>` only, and neither the specs nor the design say what happens when `<path>` exists
- **THEN** the reply names what happens to an existing `<path>` under `Gaps of the design`, and no part decides it

#### Scenario: Ordinary input handling is not a gap

- **WHEN** the Change defines the error for an unreadable input file and says nothing about an entry without an `amount`
- **THEN** the reply names no gap for it

#### Scenario: Behaviour outside the Change is not a gap

- **WHEN** the Change adds `ledger export <file>` and no requirement says what `ledger` does with no argument or an unknown subcommand
- **THEN** the reply names no gap for it, and no part plans or tests it

#### Scenario: Plan rule followed

- **WHEN** the project layer declares a rule `API-DOC-1` for stage `plan` and paths `src/**`, "a part that adds or changes a function exported from a module under `src/` ends with a task that documents it in `docs/api.md`", and the Change adds the exported `toCsv` in `src/csv.js`
- **THEN** the part that adds `toCsv` holds `docs/api.md` in its `files`, ends with the task that documents `toCsv` there, and names `API-DOC-1`

### Requirement: Plan shape for short waves

`plan-draft` SHALL cut the parts so that parts without a dependency between them run in the same wave: a part names in `depends-on` only the parts whose output it uses, a contract that several parts use is put into a small early part, and parts of one wave share no file. A part SHALL be `isolation: shared` only when it changes state outside its `files` that a parallel part could also change (a lockfile, generated code, a migration sequence); every other part SHALL be `worktree`. The plan SHALL have the fewest waves the dependencies allow, and the reply SHALL state the number of waves.

Before it ends, `plan-draft` SHALL run `bdk plan check` on the parts directory and SHALL fix the parts until it exits 0.

#### Scenario: Check passes

- **WHEN** `plan-draft` has written the parts
- **THEN** `bdk plan check openspec/changes/<change>/plan/parts` exits 0, and the reply states the parts and the waves it reported

#### Scenario: Oversized part split

- **WHEN** `bdk plan check` reports a `max-tasks` problem for part `02`
- **THEN** `plan-draft` splits part `02` and runs the check again until it exits 0

### Requirement: plan-draft fixes a failed verification

When the last report `.bdk/runs/<change>/plan/verify-N.md` (the highest N) does not pass, `plan-draft` SHALL edit the existing parts so that every item of its `Must address` is fixed, SHALL apply a `Should consider` item only when it changes no other part, SHALL leave every other part unchanged, and SHALL name in its reply the item IDs it fixed. It SHALL then run `bdk plan check` as above.

#### Scenario: Fix after a failed report

- **WHEN** `plan/verify-1.md` reads `Verdict: FAIL` with `M1` naming a missing `depends-on` of part `02`
- **THEN** `plan-draft` adds that dependency to part `02`, leaves part `01` unchanged, and the reply names `M1` as fixed

### Requirement: verify-plan runs in the verifier agent

`verify-plan` SHALL run inside a `bdk:verifier` agent (spec `bdk-verifier`). When the skill is invoked in any other thread, it SHALL start one `bdk:verifier` agent with the prompt to run `bdk:verify-plan` for the Change, wait for it, and pass on its verdict line and report path; it SHALL NOT check the plan itself.

#### Scenario: Invoked by the user

- **WHEN** the user runs `/bdk:verify-plan add-csv-export` in the main thread
- **THEN** a `bdk:verifier` agent runs the check and the main thread replies with the verdict line and the path of the report

### Requirement: verify-plan checks the plan against the code

`verify-plan` SHALL read every part, the proposal, the spec deltas, the design, the previous plan report if any, the code the tasks name, and for each part the rules `bdk rules for --stage plan` selects for the part's `files`, and SHALL run `bdk plan check` on the parts. It SHALL write its report to `.bdk/runs/<change>/plan/verify-N.md`, N being one more than the highest existing N (1 when none), in the body of spec `bdk-verifier`, and SHALL change no other file.

It SHALL put into `Must address` every problem that would make an implementer build the wrong thing, fail or stop:

- a problem `bdk plan check` reports;
- a task without one of the lines `File:`, `Interface:` and `Verified by:`, or with a `File:` path that is not in the part's `files`;
- a path, function, command or type a task names as existing that does not exist as named in the code;
- a scenario of the spec deltas named by no part, or by more than one;
- a decision of the design that no task carries out;
- a part that uses what another part creates without depending on it, directly or through other parts;
- a part whose implementer would need a fact that only another part states;
- a `Verified by:` line that names commands by exclusion, or a command that spends money, needs credentials or reaches a shared or external system;
- a caller of a changed interface whose behaviour changes and that no task covers;
- a part that breaks a rule `bdk rules for --stage plan --files <file>...` selects for that part's `files`, named by the rule's id.

Every other remark, such as a wave that a different cut would save, code inside a task, or an unclear sentence, SHALL go into `Should consider`.

#### Scenario: Defects found

- **WHEN** the plan of `add-csv-export` names a function the code does not have, leaves the scenario `Missing input file` to no part, and lets part `02` use what part `01` creates without depending on it
- **THEN** `.bdk/runs/add-csv-export/plan/verify-1.md` starts with `Verdict: FAIL` and its `Must address` holds one item for each of the three problems, each with an `Evidence:` line

#### Scenario: Sound plan passes

- **WHEN** the plan covers every scenario once, names only existing code, and declares every dependency
- **THEN** the report starts with `Verdict: PASS`

#### Scenario: Plan unchanged

- **WHEN** `verify-plan` runs on any plan
- **THEN** no file under `openspec/` and no code file is created, changed or removed

#### Scenario: Part breaks a plan rule

- **WHEN** the project declares `API-DOC-1` for stage `plan` and paths `src/**`, part `01` adds the exported `toCsv` in `src/csv.js` with no `docs/api.md` task, and part `02` changes only `bin/ledger.js`, `test/cli.test.js` and `package.json`
- **THEN** the report starts with `Verdict: FAIL`, its `Must address` holds an item naming `API-DOC-1` and part `01`, and no item says part `02` breaks `API-DOC-1`

### Requirement: Eval cases of the plan blocks

The `bdk` eval suite SHALL hold `block` cases for both blocks on a shared fixture of a configured project with an OpenSpec Change ready to plan: `plan-draft-csv-export` grading the written parts (frontmatter, task contract lines, acceptance scenarios) and the steps (the design read before a part is written) and the reply (the parts and waves); `plan-draft-fix-after-verify` grading that the parts a failed report names are fixed after the report is read; `verify-plan-defects` grading that the report fails and names each planted defect; `verify-plan-sound` grading that a sound plan passes; `plan-draft-rules` grading that the parts follow a project rule of stage `plan` and name its id; `verify-plan-rules` grading that a plan breaking a project rule of stage `plan` fails with an item naming the rule's id. Each case SHALL also grade that its skill fired. The measured with and without results SHALL be recorded in the Change's design.

#### Scenario: Cases load in CI

- **WHEN** `pnpm test` runs the free eval check
- **THEN** the `plan-draft-*` and `verify-plan-*` cases, `plan-draft-rules` and `verify-plan-rules` included, load with no error at zero cost and their scaffolds exit 0

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

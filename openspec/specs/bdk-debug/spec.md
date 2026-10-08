# bdk-debug Specification

## Purpose

Defines how the `bdk` plugin fixes a reported bug: the block `diagnose-bug`, which reproduces the bug on the product, finds its root cause and writes a one-part fix Change, and the orchestrator `/bdk:debug`, which gates the fix, builds it test-first through `/bdk:execute` and reviews it with `/bdk:auto-review`.

## Requirements

### Requirement: Skills

The `bdk` plugin SHALL ship the skills `debug` (`skills/debug/`, the user command `/bdk:debug`) and `diagnose-bug` (`skills/diagnose-bug/`), both running in the main thread. `diagnose-bug` SHALL never edit product code or tests. `/bdk:debug` SHALL reproduce, diagnose, test, fix and review nothing itself: it SHALL invoke `diagnose-bug`, `commit`, `execute` and `auto-review` with the Skill tool and apply the gate.

#### Scenario: Debug composes blocks

- **WHEN** `/bdk:debug "tally total crashes after tally add 5"` runs in a configured project and the bug is reproduced
- **THEN** the trace shows the Skill calls `diagnose-bug`, then `commit`, then `execute`, then `auto-review`, and no `Edit` or `Write` of `bin/` or `test/` by the main conversation

### Requirement: Bug report and start

`/bdk:debug [<bug report> | <issue>]` and `diagnose-bug [<bug report> | <issue>]` SHALL get the configuration from their own `bdk config show` block and, in a project that is not configured or whose configuration is invalid, stop with the line that command prints, writing nothing. An issue reference (`#42`, `42`, an issue URL) SHALL be read with `gh issue view`; any other text is the report. A report without an observable symptom (what the user did and what went wrong) SHALL get one question for it before anything runs. `/bdk:debug` SHALL stop before the diagnosis when `git status --porcelain` lists changes, naming them, because the fix runs through `execute`, which needs a clean tree.

#### Scenario: Not configured

- **WHEN** `/bdk:debug "total crashes"` runs in a project without `.bdk/settings.yaml`
- **THEN** the reply is `BDK not configured: run /bdk:setup` and no file is written

#### Scenario: Dirty tree

- **WHEN** `/bdk:debug "total crashes"` runs while `src/parse.js` has uncommitted changes
- **THEN** nothing runs, nothing is written, and the reply names `src/parse.js` and asks to commit or stash it first

### Requirement: Reproduction first

`diagnose-bug` SHALL name the fix Change (the name the user gives, else `fix-<slug>`, or `<issue>-fix-<slug>` from an issue) and reproduce the bug before it reads the code for a cause: through a `tools.e2e` item driven as a user would (started from `start`, waited for with `ready`, stopped afterwards), or, without one, through the closest public interface (the command or exported function the report names). It SHALL write `.bdk/runs/<change>/debug/reproduction.md` with the steps, the expected and the observed behaviour, and the decisive output. When the observed behaviour matches the expected one, it SHALL write `debug/diagnosis.md` with `Status: not-reproduced`, create no Change, and reply with what it ran and what would help reproduce the bug.

#### Scenario: Bug reproduced as a user

- **WHEN** the report says `tally total` crashes after `tally add 5`, and the project has a `cli` item in `tools.e2e`
- **THEN** the trace runs `tally.js add 5` and `tally.js total` in a scratch directory, and `debug/reproduction.md` holds the crash output under its observed behaviour

#### Scenario: Not reproduced

- **WHEN** the report says `tally total` prints a wrong sum after `tally add 2.5`, and the product prints the right sum
- **THEN** `debug/diagnosis.md` starts with `Status: not-reproduced`, `openspec/changes/` holds no new Change, and no product file changed

### Requirement: Fix Change

After a reproduction, `diagnose-bug` SHALL find the root cause in the code and write the fix Change with `openspec new change <change> --schema bdk`: `proposal.md` (the bug and its report under Why, the fix under What Changes, the capability); a spec delta holding a scenario that states the expected behaviour of the reproduction with its exact input (an existing requirement copied whole under `MODIFIED` with the scenario added, or the scenario already there kept, or an `ADDED` requirement when no main spec covers the behaviour); `design.md` with the reproduction, the root cause with its file and line, the fix decision and the call sites the fix reaches; and `plan/parts/01.md` in the plan part format (`isolation: shared`, `depends-on: []`, `files` with the code and the test file) whose acceptance scenario is the reproduction scenario and whose tasks name the test that reproduces the bug. The part SHALL pass `bdk plan check`. It SHALL write `debug/diagnosis.md` with `Status: ready`, the Change, the root cause and the part.

#### Scenario: Fix Change of a reproduced bug

- **WHEN** `diagnose-bug` reproduces the crash of `tally total` caused by `add` storing the amount as text
- **THEN** `openspec/changes/fix-<slug>/` holds `proposal.md`, a spec delta under `specs/tally/` with a scenario that adds `5` and expects `Total: 5.00`, `design.md` naming `bin/tally.js`, and `plan/parts/01.md` listing `bin/tally.js` and a test file; `debug/diagnosis.md` starts with `Status: ready`

#### Scenario: Fix too large for one part

- **WHEN** the root cause needs a change beyond `plan.part.max-tasks` or `plan.part.max-files`, or a decision between designs the user should make
- **THEN** `diagnose-bug` writes the proposal, the spec delta and `design.md` but no plan part, `debug/diagnosis.md` starts with `Status: too-large`, and `/bdk:debug` stops naming `/bdk:design <change>`

### Requirement: Gate

After `Status: ready`, `/bdk:debug` SHALL apply `policy.gates.design`: `auto` goes on without asking; `manual` (the default) SHALL ask the user once whether to fix as the diagnosis says, naming the root cause, the reproduction scenario and the part, and SHALL commit nothing and start nothing until approved. Without `AskUserQuestion` it SHALL ask in its reply and end its turn. An approval SHALL be written to `debug/gate.md` (`Gate: approved`, `By: user` or `By: policy.gates.design auto`).

#### Scenario: Manual gate

- **WHEN** `/bdk:debug` runs with `policy.gates.design` unset and the diagnosis is ready
- **THEN** the reply names the root cause and asks whether to fix, no commit is made, no `bdk:lead` starts, and `debug/gate.md` does not exist

### Requirement: Fix through execute and review

After the gate, `/bdk:debug` SHALL switch to the branch `<change>` when the current branch is the base branch (`origin/HEAD`, else `main`), invoke `commit` for `openspec/changes/<change>/` only, then invoke `execute <change>` (the implementer writes the reproduction test, sees it red, fixes the code, sees it green; the conformer checks the part; the lead commits), then, when `execute/result.md` reads `Status: done`, invoke `auto-review <change>`. A blocked execute or review SHALL stop the run with the blocker and its command. It SHALL never edit code, tests or the Change itself.

#### Scenario: Reproduced bug fixed with a test

- **WHEN** `/bdk:debug` runs on the tally crash with `policy.gates.design: auto`
- **THEN** `execute/part-01.md` starts with `Status: done` and records the reproduction test `red seen; green seen`, the branch `fix-<slug>` holds the commits of the Change and of the fix, `review/result.md` exists, and `tally add 5` then `tally total` prints `Total: 5.00`

### Requirement: Debug result and resume

`/bdk:debug` SHALL write `.bdk/runs/<change>/debug/result.md`, replacing an earlier one: the first line `Status: done` (the fix is built and the review result is `Status: done`) or `Status: blocked`; then `## Bug` (the report in one line, the reproduction and the root cause), `## Fix` (the reproduction test, the changed files, the commits), `## Review` (the first line of `review/result.md` and its rounds), `## Blockers` and `## Decisions taken without the user`, an empty section holding `- None.` It SHALL reply with the status line, the path, and on `Status: done` the next step `/bdk:close <change>`. Started again with the Change name, it SHALL resume from the first missing file: `debug/diagnosis.md`, `debug/gate.md`, the commit of the Change, `execute/result.md`, `review/result.md`, `debug/result.md`.

#### Scenario: Resume after the fix

- **WHEN** `/bdk:debug fix-total-crash` runs and `debug/gate.md`, a committed Change and `execute/result.md` with `Status: done` exist, but no `review/result.md`
- **THEN** it starts with `auto-review fix-total-crash` and runs neither `diagnose-bug` nor `execute`

### Requirement: Eval cases of debug

The suite SHALL hold the block cases `diagnose-bug-reproduced` and `diagnose-bug-not-reproduced`, and the orchestrator cases `debug-fix` (auto gate, the bug reproduced, fixed with a test, the fix Change reviewed) and `debug-manual-gate` (the run stops at the gate), on a shared fixture of a configured project with a seeded bug.

#### Scenario: Acceptance signal

- **WHEN** `debug-fix` runs with the plugin
- **THEN** its graders pass: the reproduction test is seen red and then green in `execute/part-01.md`, the fixed product prints the expected output, and `debug/result.md` exists

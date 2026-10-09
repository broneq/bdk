# bdk-cli/run Specification

## Purpose

Defines `bdk run status`, the read-only command that renders the state of an autopilot run - its queue, the part states of the current Change and the open stage of every queued Change, derived from files by the resume table - so a skill resumes a run without reading those files turn by turn.

## Requirements

### Requirement: Run status command

`bdk run status` SHALL take no argument and SHALL read, relative to the working directory, `.bdk/runs/run.json`, and for every Change in its queue the run directory `.bdk/runs/<change>/` and the OpenSpec Change directory. It SHALL write no file, SHALL NOT call git, GitHub or the network, and SHALL exit 0 whenever it can read `run.json`, whatever stage it derives.

#### Scenario: Status of a run

- **WHEN** `bdk run status` runs in a project whose `.bdk/runs/run.json` is valid
- **THEN** stdout holds the run mode, the current Change, one line per queued Change with its derived stage, and the part states of the current Change, and the exit code is 0

#### Scenario: Nothing written

- **WHEN** `bdk run status` runs on any project
- **THEN** no file under the working directory is created, changed or removed

#### Scenario: No run

- **WHEN** `bdk run status` runs where `.bdk/runs/run.json` does not exist
- **THEN** the CLI reports `env/no-run` with a hint to start a run with `/bdk:run`, and exits 3

### Requirement: run.json schema

`.bdk/runs/run.json` SHALL be a JSON object with `version` equal to `1`, `mode` equal to `interactive` or `non-interactive`, `queue` a non-empty array of entries `{"change": <name>, "issue": <positive integer, optional>}` with distinct names, and `current` the name of one entry of `queue`. A Change name SHALL match `^[a-z0-9][a-z0-9-]*$`. Unknown keys SHALL be ignored. A file that is not valid JSON or breaks this schema SHALL be reported as `env/invalid-run-state` naming the file and the first offending key, with exit 3.

#### Scenario: Valid run file

- **WHEN** `run.json` is `{"version":1,"mode":"interactive","queue":[{"change":"v3-12-foo","issue":12}],"current":"v3-12-foo"}`
- **THEN** `bdk run status` reports mode `interactive` and current Change `v3-12-foo` with issue 12

#### Scenario: Current not in the queue

- **WHEN** `run.json` names a `current` that no queue entry holds
- **THEN** the CLI reports `env/invalid-run-state` naming `run.json` and `current`, and exits 3

#### Scenario: Unsafe Change name

- **WHEN** a queue entry's `change` is `../x` or holds a capital letter
- **THEN** the CLI reports `env/invalid-run-state` naming the key, and reads no path built from that name

### Requirement: state.json schema

`.bdk/runs/<change>/state.json` SHALL be a JSON object with `version` equal to `1` and `parts`, an object whose keys are part ids of two digits and whose values are `{"status": "pending" | "done" | "blocked", "attempts": <integer >= 0>, "reason": <string, optional>}`, and optionally `waves`, an object whose keys are wave numbers (decimal integers from 1) and whose values are `{"base": <commit, string>, "status": "pending" | "done" | "blocked", "reason": <string, optional>}`. A missing `state.json` SHALL mean that no part has a state. A file that is not valid JSON or breaks this schema SHALL be reported as `env/invalid-run-state` naming the file and the first offending key, with exit 3.

#### Scenario: Missing state file

- **WHEN** a Change has plan parts and no `state.json`
- **THEN** every part is reported as `pending` with 0 attempts

#### Scenario: Invalid status

- **WHEN** `state.json` holds a part with `"status": "finished"`
- **THEN** the CLI reports `env/invalid-run-state` naming the file and `parts.<id>.status`, and exits 3

#### Scenario: Wave state

- **WHEN** `state.json` holds `"waves": {"1": {"base": "abc123", "status": "done"}, "2": {"base": "def456", "status": "pending"}}`
- **THEN** the CLI reads it with no problem, and a wave with `"status": "green"` is reported as `env/invalid-run-state` naming `waves.<n>.status`

### Requirement: Files the derivation reads

For a Change `<change>` the command SHALL read these files, and only these:

- The OpenSpec Change directory: `openspec/changes/<change>/` when it exists, otherwise the archived `openspec/changes/archive/<YYYY-MM-DD>-<change>/` with the latest date. The Change is archived when only the archived directory exists.
- In the OpenSpec Change directory: `proposal.md`, `design.md`, and the plan parts `plan/parts/NN.md`, whose two-digit file stem is the part id.
- In `.bdk/runs/<change>/`: `state.json`; `design/verify-N.md` and `plan/verify-N.md`, where the last report is the one with the highest number N, a positive integer written without leading zeros (other names are ignored); the round directories `review/round-N/`, each with `review.md` and `findings.jsonl`; and `close/spec-conformance.md` and `close/pr.md`.

A verify report and `close/spec-conformance.md` SHALL pass when the first verdict line in it reads `Verdict: PASS`, matched without regard to case and to Markdown emphasis or heading marks around the word `Verdict` and the value; a report whose first verdict line reads `Verdict: FAIL`, or that has no verdict line, does not pass. `close/pr.md` SHALL mean that the pull request of the Change was opened.

#### Scenario: Verdict in Markdown

- **WHEN** the last `design/verify-N.md` holds the line `**Verdict:** PASS`
- **THEN** that report passes

#### Scenario: Report without a verdict

- **WHEN** the last `plan/verify-N.md` holds no verdict line
- **THEN** that report does not pass

#### Scenario: Archived Change

- **WHEN** `openspec/changes/<change>/` is absent and `openspec/changes/archive/2026-10-07-<change>/` holds the Change
- **THEN** the command reads `proposal.md`, `design.md` and `plan/parts/` from the archived directory, and row 9 does not report the step `archive`

### Requirement: Findings of a review round

To decide rows 7 and 8 of the resume table, the command SHALL fold `review/round-N/findings.jsonl` of the last round as `bdk findings list` folds it (spec `bdk-cli/findings`): the latest level and the latest decision per finding win. Every line that fold skips SHALL be listed as a warning naming the file, the line number and the reason, and the command SHALL derive the stage from the other lines. A missing `findings.jsonl` SHALL mean a round without findings.

#### Scenario: Latest level wins

- **WHEN** a finding has a `level` line `blocker` followed by a `level` line `should-fix`, and no decision
- **THEN** the finding is not an open blocker

#### Scenario: Broken line

- **WHEN** line 3 of the last round's `findings.jsonl` is not valid JSON
- **THEN** the command skips it, derives the stage from the other lines, lists a warning naming the file and line 3, and exits 0

### Requirement: Resume table

The command SHALL derive the open stage of every queued Change by checking these rows in order; the first matching row wins. "Last round" is the round directory with the highest number.

| Row | Matches when | Stage | Step |
| --- | ------------ | ----- | ---- |
| 1 | no OpenSpec Change directory, or no `proposal.md` in it | `propose` | - |
| 2 | no `design.md`, or no `design/verify-N.md`, or the last one does not pass | `design` | - |
| 3 | no plan part, or no `plan/verify-N.md`, or the last one does not pass | `plan` | - |
| 4 | a part, from `plan/parts/` or from `state.json`, whose status is not `done`, or a wave in `state.json` whose status is not `done` | `execute` | - |
| 5 | no `review/round-N/` directory | `auto-review` | `first-round` |
| 6 | a round directory without `review.md`; the lowest such round is reported | `auto-review` | `repeat-round` |
| 7 | a finding of the last round whose latest level is `blocker` and that has no decision | `auto-review` | `triage` |
| 8 | a finding of the last round whose latest decision is `fix` | `auto-review` | `fix` |
| 9 | `close/spec-conformance.md` missing or not passing; else the Change not archived; else no `close/pr.md` | `close` | `spec-conformance`, `archive` or `pr` |

When no row matches, the stage SHALL be `done`. For each Change the result SHALL carry the stage, the step, the row number, the round number for rows 5 to 8, and a one-line reason naming the file or count that decided it.

#### Scenario: Row 1 - no proposal

- **WHEN** the queued Change has no OpenSpec Change directory
- **THEN** its stage is `propose`, row 1

#### Scenario: Row 2 - design verify failed

- **WHEN** the Change has `proposal.md` and `design.md`, and the last design report `design/verify-2.md` reads `Verdict: FAIL`
- **THEN** its stage is `design`, row 2, and the reason names `design/verify-2.md`

#### Scenario: Row 2 - no design

- **WHEN** the Change has `proposal.md` and no `design.md`
- **THEN** its stage is `design`, row 2

#### Scenario: Row 3 - plan verify failed

- **WHEN** design passed, plan parts exist and the last `plan/verify-N.md` does not pass
- **THEN** its stage is `plan`, row 3

#### Scenario: Row 3 - no plan parts

- **WHEN** design passed and `plan/parts/` holds no part
- **THEN** its stage is `plan`, row 3

#### Scenario: Row 4 - part not done

- **WHEN** plan passed, the plan has parts `01` and `02`, and `state.json` marks `01` done and `02` blocked
- **THEN** its stage is `execute`, row 4, and the reason counts 1 of 2 parts not done

#### Scenario: Row 4 - wave check not done

- **WHEN** plan passed, `state.json` marks every part done and wave 2 `pending`
- **THEN** its stage is `execute`, row 4, and the reason names wave 2

#### Scenario: Row 5 - no review round

- **WHEN** every part is done and `review/` holds no round directory
- **THEN** its stage is `auto-review`, step `first-round`, row 5, round 1

#### Scenario: Row 6 - crashed round

- **WHEN** `review/round-1/` holds `review.md` and `review/round-2/` does not
- **THEN** its stage is `auto-review`, step `repeat-round`, row 6, round 2

#### Scenario: Row 7 - blocker without a decision

- **WHEN** the last round has a report and a finding whose latest level is `blocker` and no decision
- **THEN** its stage is `auto-review`, step `triage`, row 7

#### Scenario: Row 8 - fix decision not covered

- **WHEN** every blocker of the last round has a decision and one finding's latest decision is `fix`
- **THEN** its stage is `auto-review`, step `fix`, row 8

#### Scenario: Row 9 - close from its first missing step

- **WHEN** the last round has no open blocker and no `fix` decision, `close/spec-conformance.md` passes, and the Change is not archived
- **THEN** its stage is `close`, step `archive`, row 9

#### Scenario: Row 9 - spec conformance missing

- **WHEN** the last round has no open blocker and no `fix` decision, and there is no `close/spec-conformance.md`
- **THEN** its stage is `close`, step `spec-conformance`, row 9

#### Scenario: Row 9 - no pull request

- **WHEN** spec conformance passes and the Change is archived, and there is no `close/pr.md`
- **THEN** its stage is `close`, step `pr`, row 9

#### Scenario: Done

- **WHEN** spec conformance passes, the Change is archived and `close/pr.md` exists
- **THEN** its stage is `done` and no row is reported

#### Scenario: Earlier row wins

- **WHEN** a Change has review rounds but `state.json` marks a part `pending`
- **THEN** its stage is `execute`, row 4, not a review or close stage

### Requirement: Run status output

In text mode the command SHALL print the run mode and the current Change, one line per queued Change in queue order with its stage, step, row and reason, the current Change marked, then the parts of the current Change in id order with status and attempts, then one line per warning. With `--json` it SHALL print one object `{"mode", "current", "changes": [{"change", "issue", "current", "stage", "step", "row", "round", "reason"}], "parts": [{"id", "status", "attempts", "reason"}], "warnings": [...]}`, where absent values are `null`, valid against the command's output schema.

#### Scenario: JSON result

- **WHEN** `bdk run status --json` runs on a valid run of two Changes
- **THEN** stdout is one JSON document valid against the output schema, `changes` holds two entries in queue order, exactly one with `current` true, and stderr is empty

#### Scenario: Same files, same output

- **WHEN** `bdk run status` runs twice on unchanged files
- **THEN** both outputs are byte-identical

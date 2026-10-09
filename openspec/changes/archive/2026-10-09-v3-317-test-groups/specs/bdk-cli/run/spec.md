## MODIFIED Requirements

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

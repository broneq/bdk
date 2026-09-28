## MODIFIED Requirements

### Requirement: Plan part checks

The `plan-part` kind SHALL check each part with the S1, P6 and P7 rules below, through `validate`, `done` and `part start`.

| Check          | Fails when                                                                                                                                                                                                  | Rule of `validate` and `part start` |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------- |
| `size`         | the part file is over 8 192 bytes                                                                                                                                                                           | `policy/part-too-large`             |
| `tasks`        | the part holds no task or more than 8                                                                                                                                                                       | `policy/part-too-many-tasks`        |
| `do-not-touch` | a task's `Files:` path matches a `do-not-touch` glob                                                                                                                                                        | `policy/do-not-touch-overlap`       |
| `placeholder`  | an executable field holds a placeholder (`kernel-state`, Plan part and plan index)                                                                                                                          | `policy/placeholder`                |
| `grammar`      | a task lacks `Files:`, lacks both `Test cases:` and `Verification: none`, repeats an id, or names an unknown task in `Depends on:`                                                                          | `policy/validation-failed`          |
| `spec-impact`  | `spec-impact` is absent in a `large` Change, or names a capability whose `spec-delta/<capability>.md` is missing or fails `spec delta check` (`kernel-cli/spec`); absent means `none` in `tiny` and `small` | `policy/validation-failed`          |

`done` answers any failing check with `policy/validation-failed` naming the checks; `validate` lists every check.

#### Scenario: nine kilobyte part

- **WHEN** `plan/parts/02-login.md` is 9 216 bytes and `bdk part start 02` runs
- **THEN** the exit code is 2, the error object carries `rule: policy/part-too-large` with `why` naming the size and 8 192, and no entry is written

#### Scenario: placeholder in a test case

- **WHEN** a task's `Test cases:` list holds the item `TODO`
- **THEN** `bdk validate plan-part:02 --json` reports check `placeholder` failed naming the task

#### Scenario: invalid delta fails the part

- **WHEN** part `02` declares `spec-impact: [auth/login]` and `spec-delta/auth/login.md` has a scenario without `- **THEN**`, and `bdk validate plan-part:02 --json` runs
- **THEN** check `spec-impact` fails and its `why` names `then-missing` and the delta's path and line

#### Scenario: spec-impact default by profile

- **WHEN** part `01` has no `spec-impact` field
- **THEN** check `spec-impact` passes in a `small` Change and fails in a `large` Change with `why` asking to declare `spec-impact`

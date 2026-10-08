## ADDED Requirements

### Requirement: plan-draft design-gap case on the B1-sized fixture

The suite SHALL hold the block case `plan-draft-household-book-gap`, tagged `block`, whose scaffold builds the ready-to-plan state of the B1-sized fixture through `household-book.sh` and then opens exactly one product choice in the Change `add-household-book`: a recurring entry's day SHALL be accepted from 1 to 31, and neither the spec deltas nor the design SHALL say what a recurring entry does in a month that has no such day. Every other text of the Change and its design records SHALL stay as the fixture writes it, the Change SHALL keep its 71 scenarios, and the variant SHALL be committed so the working tree is clean. Its prompt SHALL ask for the implementation plan of `add-household-book` without naming the skill or the open choice. Its graders SHALL include an `llm` grader that passes only when the final reply names the short-month choice as open and left to the user, a `file_exists` grader on the first plan part, and a `tool_used: Skill` grader for `plan-draft`. `plugins/bdk/evals/README.md` SHALL give the command that runs it with and without the plugin.

#### Scenario: Case loads with the README's grants

- **WHEN** the free check loads `plan-draft-household-book-gap` with the grants `Write Edit`
- **THEN** the case loads, carries the tag `block`, and every grader can pass

#### Scenario: Scaffold opens the short-month choice

- **WHEN** the case's scaffold runs in an empty workspace as the harness runs it
- **THEN** it exits 0, the spec delta `ledger-recurring` accepts days 1 to 31, no file of the Change or of `.bdk/runs/add-household-book/` names the range 1 to 28 or how a short month is handled, the Change holds 71 scenarios and no `plan/`, and `git status --porcelain` prints only the ignored run records

#### Scenario: Everything else is the shared fixture

- **WHEN** the variant and `household-book.sh` are built side by side
- **THEN** every file of `openspec/changes/add-household-book/` other than the `ledger-recurring` spec delta and the design is identical in both

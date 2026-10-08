## ADDED Requirements

### Requirement: plan-draft measured on the B1-sized fixture

The suite SHALL hold the block case `plan-draft-household-book`, tagged `block`, whose scaffold builds the ready-to-plan state of the B1-sized fixture through `household-book.sh`, whose prompt asks for the implementation plan of `add-household-book` without naming the skill, and whose run limits leave room for a Change of that size (`max_turns` at least 150, `timeout_seconds` at least 1800). Its graders SHALL include a `file_exists` grader on the first plan part, a `regex` grader on the trace for a passing `bdk plan check` with at most three waves, and a `tool_used: Skill` grader for `plan-draft`. `plugins/bdk/evals/README.md` SHALL give the command that runs it with and without the plugin.

#### Scenario: Case loads with the README's grants

- **WHEN** the free check loads `plan-draft-household-book` with the grants `Write Edit`
- **THEN** the case loads, carries the tag `block`, and every grader can pass

#### Scenario: Scaffold builds the ready-to-plan state

- **WHEN** the case's scaffold runs in an empty workspace as the harness runs it
- **THEN** it exits 0 and `openspec/changes/add-household-book/` holds the proposal, the design and the spec deltas but no `plan/`

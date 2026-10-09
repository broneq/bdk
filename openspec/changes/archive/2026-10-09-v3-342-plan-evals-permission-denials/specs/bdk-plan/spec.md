## MODIFIED Requirements

### Requirement: Check before every verification

Before each verifier pass the skill SHALL run `bdk plan check` on the parts. The call SHALL be the whole Bash command, `"${CLAUDE_PLUGIN_ROOT}/bin/bdk" plan check <parts dir>` with nothing before or after it (no `cd`, `;`, `&&`, `|` or `echo`), so that the grant `Bash(${CLAUDE_PLUGIN_ROOT}/bin/bdk *)` matches it and the stage is not stopped by a denied call. On exit 1 it SHALL run `plan-draft` once to clear the listed problems and check again; when the check still exits 1, it SHALL stop before the verifier and report the problems. On exit 3 it SHALL stop and pass the message on.

#### Scenario: Problems plan-draft cannot clear

- **WHEN** `bdk plan check` exits 1 before a pass and still exits 1 after `plan-draft` ran on its problems
- **THEN** no `bdk:verifier` agent starts for that pass and the reply lists the problems

#### Scenario: Check call under a narrow grant

- **WHEN** `/bdk:plan` runs on plan parts that were never checked and the run grants only `Bash(*/bin/bdk *)`
- **THEN** the check call is not denied and a `bdk:verifier` agent starts after it

### Requirement: Verify loop within the budget

After each `Verdict: FAIL` report, the skill SHALL run `plan-draft` to fix it, check the parts, and verify again, continuing the same `bdk:verifier` agent with `SendMessage` when it has that agent's ID and the tool, and otherwise starting a new `bdk:verifier` agent. One run of the skill SHALL start at most `policy.budgets.verifier` verifier passes. When the last allowed pass fails, the skill SHALL stop, run no further `plan-draft`, and report the last report's path, its open `Must address` IDs, and that `/bdk:plan <change>` continues from there. When a verifier pass returns no verdict line (it wrote no report because a command it needs was denied or failed), the skill SHALL stop, run no further block, and pass the verifier's message on.

#### Scenario: Fixed within the budget

- **WHEN** the first report fails with `M1` and the fixed plan passes
- **THEN** `plan/verify-2.md` starts with `Verdict: PASS` and names `M1` under `Closed:`

#### Scenario: Budget spent

- **WHEN** `policy.budgets.verifier` is 1 and the first report says `Verdict: FAIL`
- **THEN** no second `bdk:verifier` pass starts, `plan-draft` does not run after the report, and the reply names `plan/verify-1.md`, its `Must address` IDs and `/bdk:plan add-csv-export`

#### Scenario: Verifier without a verdict

- **WHEN** the `bdk:verifier` agent returns that its `bdk plan check` call was denied and it wrote no report
- **THEN** no `plan-draft` runs after it, no further verifier pass starts, and the reply passes the denied command on

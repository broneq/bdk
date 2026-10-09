## MODIFIED Requirements

### Requirement: Check before every verification

Before each verifier pass the skill SHALL run `bdk plan check` on the parts. The call SHALL be the whole Bash command, written as `${CLAUDE_PLUGIN_ROOT}/bin/bdk plan check <parts dir>` with no quotes around the path and no `cd`, `;`, `&&` or `echo` around it, so that the grant `Bash(${CLAUDE_PLUGIN_ROOT}/bin/bdk *)` matches it and the stage is not stopped by a denied call. On exit 1 it SHALL run `plan-draft` once to clear the listed problems and check again; when the check still exits 1, it SHALL stop before the verifier and report the problems. On exit 3 it SHALL stop and pass the message on.

#### Scenario: Problems plan-draft cannot clear

- **WHEN** `bdk plan check` exits 1 before a pass and still exits 1 after `plan-draft` ran on its problems
- **THEN** no `bdk:verifier` agent starts for that pass and the reply lists the problems

#### Scenario: Check call under a narrow grant

- **WHEN** `/bdk:plan` runs on plan parts that were never checked and the run grants only `Bash(*/bin/bdk *)`
- **THEN** the check call is not denied and a `bdk:verifier` agent starts after it

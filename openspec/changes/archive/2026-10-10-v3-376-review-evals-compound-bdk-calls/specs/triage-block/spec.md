## ADDED Requirements

### Requirement: Single-command bdk calls in triage

`triage` SHALL run every `bdk` and Lavish call as the whole Bash command, with literal arguments and nothing before or after it: no `cd`, `;`, `&&`, `|`, `echo` and no shell variable, so that the skill's grants match it. It SHALL read files with Read, Grep and Glob. Every `triage-*` eval case SHALL hold the grader `no-denied-call`, which fails when the run's trace holds a denied tool call.

#### Scenario: Triage cases under the narrow grant

- **WHEN** the `triage-*` cases run with the grants the eval README names for them
- **THEN** their `no-denied-call` graders pass

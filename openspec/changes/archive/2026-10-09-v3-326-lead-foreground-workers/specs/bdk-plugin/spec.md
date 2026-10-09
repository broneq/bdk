## ADDED Requirements

### Requirement: Every Agent call names its run mode

Every `Agent` call that a skill or an agent of the `bdk` plugin writes SHALL name its run mode as the `run_in_background` parameter, because a host that gets no value may start the agent in the background. An agent the caller waits for SHALL be started with `run_in_background: false`: every worker a `bdk:lead` starts (`bdk:implementer`, `bdk:conformer`, `bdk:reviewer`, `bdk:integration-reviewer`, `bdk:e2e-tester`, `bdk:judge`), every block an orchestrator starts, and the agent a block starts when it is typed in the main thread. Only an orchestrator that starts a `bdk:lead` with `execution.lead: background` SHALL pass `run_in_background: true`; with `execution.lead: foreground` it SHALL pass `run_in_background: false`. A `bdk:lead` SHALL NOT read or poll a worker's task output file and SHALL NOT sleep to wait for a worker. A workspace test SHALL fail and name the skill and the agent when a paragraph of a `SKILL.md` that starts `subagent_type: "bdk:<agent>"` names neither `run_in_background: false` nor `run_in_background: true`.

#### Scenario: Every skill names the run mode

- **WHEN** the plugin's tests run on a clean checkout
- **THEN** the run-mode check passes: every paragraph of a `SKILL.md` that starts `subagent_type: "bdk:<agent>"` names `run_in_background: false` or `run_in_background: true`

#### Scenario: A call without a run mode is caught

- **WHEN** a paragraph of `skills/review-round/SKILL.md` starts `subagent_type: "bdk:reviewer"` and names no `run_in_background` value
- **THEN** the check fails and names `review-round: reviewer`

#### Scenario: Review workers run in the foreground

- **WHEN** `/bdk:debug` runs on the `debug-fix` scaffold to its review round
- **THEN** the meta file of every worker the review lead starts reads `"requestShape":"foreground"`, and `bdk diagnostics report` for the session lists no `slow-call` for the review lead

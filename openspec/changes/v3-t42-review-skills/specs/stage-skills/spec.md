## ADDED Requirements

### Requirement: Author self-check before verification

`/bdk:design` and `/bdk:plan` SHALL check their own draft against the blocking categories and the not-a-fail list of their context (`kernel-cli/ctx`, the `verifier-policy` part; P8) before they run `/bdk:verify-design` or `/bdk:verify-plan`. Each blocking category the draft would fail SHALL be corrected in the draft first. Nothing on the not-a-fail list SHALL be corrected for the check's sake. The check SHALL write no ledger entry and no file of its own, so the verifier still judges the draft on a fresh context.

#### Scenario: plan corrects a claim before verification

- **WHEN** the plan draft states a function signature that the code does not have, a `false-code-claim`
- **THEN** `/bdk:plan` corrects the task before it first runs `/bdk:verify-plan`, and the first verifier package is built from the corrected plan

#### Scenario: context carries the lists

- **WHEN** the content test reads `skills/stages/design/SKILL.md` and `skills/stages/plan/SKILL.md` and the kernel's context manifest
- **THEN** each skill names the self-check step before its `/bdk:verify-*` step, and the manifest entries of `design` and `plan` hold the `verifier-policy` part

## MODIFIED Requirements

### Requirement: run drives a Change through the stages

`/bdk:run [--auto] [<intent>]` SHALL loop on `bdk next` and start, through the host's `Skill` tool, the stage skill `next` names in `command` (`kernel-cli/graph`, bdk next): `/bdk:change` with the intent when no Change is active, then `/bdk:design`, `/bdk:plan`, `/bdk:execute`, `/bdk:cr` and `/bdk:close`. `run` SHALL start `/bdk:cr` at the review stage like any other stage skill: `cr` writes no file, so the `Edit` and `Write` refusal that `disallowed-tools` of `execute` leaves on the turn (HOST-FACTS `skill-tool-disallowed`) does not hinder it (T42-B1). Each stage skill runs with its own frontmatter and body; `run` holds no copy of a stage procedure. After each stage skill it SHALL run `bdk next` again. It SHALL write no state of its own: every gate a run passes is written by the kernel's hooks (`kernel-cli/hooks`, Pre-tool guards, Stage skill), never by a command `run` calls. `run` SHALL set `disable-model-invocation: true`.

#### Scenario: run from an intent to the review stage

- **WHEN** the user types `/bdk:run --auto "<intent>"` on the fixture with no active Change and every stage succeeds
- **THEN** a Change was opened, every `execute-part` instance is done, the ledger holds a `merge` report of a `review-fix` ticket, the `review` node is done, the `transition` of `gate:review` has `source: policy`, and the Change is archived

#### Scenario: run closes a reviewed Change

- **WHEN** the user types `/bdk:run --auto` on a Change whose `review` node is done and `gate:review` is ready
- **THEN** the Change is archived and the `transition` of `gate:review` has `source: policy`

### Requirement: run stops only where the user is needed

A run SHALL stop and end with its closing render when `next` waits on a gate the kernel refused to pass by policy (`guard/gate-manual`), when the Change is parked, when a stage skill reports a refusal it could not resolve, or when the Change is closed. Blocking review entries are not a stop: `/bdk:cr` fixes them on the `review-fix` budget, and a park of that budget stops the run as any park does. It SHALL NOT stop for a pending `review: true` entry. While it runs it SHALL print one line per stage it enters or leaves, and the full closing render only when it stops (T41 "To resolve in the spec").

#### Scenario: manual design gate

- **WHEN** the user types `/bdk:run "<intent>"` without `--auto` and `policy.gates.design` is `manual`
- **THEN** the run ends after the design stage, `gate:design` is ready and not done, no plan part exists, and the final reply names `/bdk:plan` as the command the user types

#### Scenario: review gate needs the user

- **WHEN** the user types `/bdk:run "<intent>"` without `--auto`, `policy.gates.review` is `manual` and every stage succeeds
- **THEN** the run ends after `/bdk:cr` with the `review` node done and `gate:review` ready and not done, and the final reply names `/bdk:close`

### Requirement: close reports the PR summary

`/bdk:close` SHALL end with the `summary` of `bdk change close` verbatim, the gates passed by policy (`gatesByPolicy`), each named by its id such as `gate:review`, the archive path and the commit, the regenerated rule projection files when there are any, and the next step: open the PR with that summary. It SHALL NOT open the PR itself.

#### Scenario: summary shown

- **WHEN** `/bdk:close` closes a Change with one live `assumption` entry
- **THEN** the final reply holds the PR summary with that assumption and names the archive path

# triage-block Specification

## Purpose

The `triage` block of the `bdk` plugin: it decides what happens to every finding of a judged review round - fix, accept or defer - by the fixed policy in auto mode or by the user's choices in manual mode, and records each decision in the round's findings log.

## Requirements

### Requirement: Triage block skill

The `bdk` plugin SHALL ship the skill `triage` (`/bdk:triage`), run in the main thread and by no agent, because manual triage talks to the user. It SHALL start with a `!` block running `bdk config show` and SHALL stop with the line "BDK not configured: run /bdk:setup", writing nothing, when that block reports the project unconfigured. The block SHALL record decisions and refresh the round report only: it SHALL NOT change a project file, add a finding, set a level, commit, or start an agent; the only GitHub write it SHALL make is an issue the user chose to create in manual triage.

#### Scenario: Not configured

- **WHEN** `/bdk:triage` runs in a project without `.bdk/settings.yaml`
- **THEN** it replies "BDK not configured: run /bdk:setup" and the findings log is unchanged

### Requirement: Round to triage

The block SHALL take a round directory `.bdk/runs/<change>/review/round-<N>/` holding `findings.jsonl` and `review.md`. Without one, it SHALL take the highest round of the Change the arguments name, else of `.bdk/runs/manual/review/`, among the rounds that hold `review.md`. It SHALL read the round with `bdk findings list <log>` and SHALL decide only the findings without a decision, so a decision already recorded stays. When a finding of the round has no level, the block SHALL decide nothing, name the unleveled findings, and say that the round needs the judge first.

#### Scenario: Unleveled round

- **WHEN** `/bdk:triage` runs on a round whose log holds a finding without a `level` event
- **THEN** it appends no `decision` line and its reply names that finding and the judge

#### Scenario: Resumed triage

- **WHEN** a round holds four leveled findings, two of them already decided, and triage runs on it
- **THEN** it records decisions for the other two only

### Requirement: Auto-mode policy

When `policy.gates.review` is `auto`, the block SHALL decide every undecided finding by its level, without a page and without a question to the user:

| Level | Decision |
|---|---|
| `blocker` | `fix` |
| `should-fix` | `fix` |
| `nice-to-have` | `defer`, without an issue |
| `not-a-problem` | `accept` |

The policy SHALL NOT be configurable, and the block SHALL create no GitHub issue in auto mode.

#### Scenario: Auto mode decides by policy and records every decision

- **WHEN** `policy.gates.review` is `auto` and a judged round holds one finding of each level, none decided
- **THEN** the log holds a `decision` line for each of the four - `fix` for the `blocker` and the `should-fix`, `defer` without an issue for the `nice-to-have`, `accept` for the `not-a-problem` - each with a reason naming the policy, and the user was asked nothing

### Requirement: Manual decision surfaces

When `policy.gates.review` is `manual` or absent, the block SHALL ask the user to decide every undecided finding in one ask, each finding shown with its level, place, summary and evidence, and the policy answer of the auto-mode table preselected as the recommendation. The choices SHALL be `fix`, `accept`, `defer`, and `defer` with an issue, which is an issue reference the user gives or an issue the user asks the block to create. The block SHALL ask through, in this order of preference:

1. a page under `.lavish/` that the model writes following the `lavish-axi` playbooks, opened and polled with `npx -y lavish-axi`, each Lavish command a Bash command of its own, with no `;`, `&&`, pipe or `echo` around it;
2. `AskUserQuestion`, when the page cannot open (the open command exits non-zero);
3. the reply, when `AskUserQuestion` is not available either: the findings as numbered questions with the recommendation marked, ending the turn without recording a decision.

A finding the user leaves unanswered SHALL stay undecided; the block SHALL NOT record a decision the user did not make, except that an explicit instruction to take the recommendations decides every finding it covers.

#### Scenario: Choices through a Lavish page

- **WHEN** triage runs in manual mode, `npx -y lavish-axi` opens the page, and the user's reply chooses `fix` for the `nice-to-have` finding and the recommendation for the rest
- **THEN** a page under `.lavish/` was written, and the log records `fix` for the `nice-to-have` finding and the policy answer for the other three

#### Scenario: No browser review

- **WHEN** triage runs in manual mode and `npx -y lavish-axi` exits non-zero on opening the page
- **THEN** the block asks with `AskUserQuestion` or in its reply, offers the choices with the recommendation marked, and records no decision the user has not made

#### Scenario: Lavish commands run alone

- **WHEN** triage runs in manual mode and opens and polls its page
- **THEN** every Bash command that calls `lavish-axi` is that call alone, and none is denied for falling outside the grant `Bash(npx -y lavish-axi *)`

### Requirement: Decisions recorded through the CLI

Every decision SHALL be appended with `bdk findings decide <log> <id> <decision>` and a `--reason`, never by editing the log: in auto mode a reason naming `policy.gates.review auto` and the level, in manual mode a reason saying the user chose it, with the user's note when there is one. A `defer` with an issue SHALL pass the issue reference with `--issue`. After the decisions the block SHALL run `bdk findings report <log>` so `review.md` shows them, and SHALL reply with the report path, the count per decision, and the id and summary of each finding decided `fix`.

#### Scenario: Report refreshed

- **WHEN** triage has recorded the decisions of a round
- **THEN** `review.md` of the round lists each decision under its finding, and the reply names the findings to fix

### Requirement: Eval cases of the triage block

The suite SHALL hold the block cases `triage-auto-policy`, `triage-lavish` and `triage-ask`, tagged `block`, built on a judged round of the shared `monthly-report` fixture with one finding of each level. `triage-auto-policy` SHALL set `policy.gates.review: auto` and grade a `decision` line per finding by the policy and that no question was asked; `triage-lavish` SHALL answer through a `lavish-axi` stand-in and grade that the user's choice is recorded; `triage-ask` SHALL make the page fail to open and grade that the user is asked and no decision is invented. Run with and without the plugin, each case SHALL report a with-arm score above the without-arm score.

#### Scenario: Effect over no plugin

- **WHEN** the three cases run with and without the plugin
- **THEN** each case's with-arm score is above its without-arm score, and the results are recorded in the Change design

### Requirement: Last round of the budget

The block SHALL take `--last-round`, given by `/bdk:auto-review` when the round is the last that `policy.budgets.review-rounds` allows. With it, in auto mode a `should-fix` finding SHALL be decided `defer` without an issue, with a reason naming `policy.budgets.review-rounds`, and in manual mode `defer` SHALL be the recommendation for a `should-fix` finding. Every other level SHALL be decided as without it.

#### Scenario: Should-fix in the last round, auto mode

- **WHEN** `policy.gates.review` is `auto` and triage runs with `--last-round` on a judged round holding one finding of each level
- **THEN** the `blocker` is decided `fix`, the `should-fix` `defer` with a reason naming `policy.budgets.review-rounds`, the `nice-to-have` `defer` and the `not-a-problem` `accept`

### Requirement: Single-command bdk calls in triage

`triage` SHALL run every `bdk` and Lavish call as the whole Bash command, with literal arguments and nothing before or after it: no `cd`, `;`, `&&`, `|`, `echo` and no shell variable, so that the skill's grants match it. The free text of `--reason` SHALL hold no backtick, `$` or backslash, because the host reads a backtick or `$` inside double quotes as a substitution and denies the call. It SHALL read files with Read, Grep and Glob. Every `triage-*` eval case SHALL hold the grader `no-denied-call`, which fails when the run's trace holds a denied tool call.

#### Scenario: Triage cases under the narrow grant

- **WHEN** the `triage-*` cases run with the grants the eval README names for them
- **THEN** their `no-denied-call` graders pass

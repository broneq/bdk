## MODIFIED Requirements

### Requirement: The orchestrator only composes the design blocks

The skill SHALL run the design blocks in this order: `explore` as a `bdk:explorer` agent, `design-draft` as a `bdk:designer` agent whose prompt runs the skill `bdk:design-draft`, and `verify-design` as a `bdk:verifier` agent whose prompt runs the skill `bdk:verify-design`, each agent with `model` and `effort` from `models.explorer`, `models.designer` or `models.verifier` as spec `bdk-cli/config` ("Every agent is a models role") says. Every block SHALL start in the foreground (`run_in_background: false`) and the skill SHALL wait for its result before the next step; when an agent runs in the background anyway, the skill SHALL end its turn with one line naming the running block and resume from the run files when it is notified. When the designer ends with open questions or with an open Lavish page, the skill SHALL ask them or poll the page as spec `design-blocks` ("Questions follow the policy and the session") says and pass the answers back to the designer. It SHALL NOT map the code, write or fix a spec delta, `design.md` or `proposal.md`, or check the design itself. The only file it SHALL write is the gate file `.bdk/runs/<change>/design/gate.md`. It SHALL NOT commit, create a branch or start the plan stage.

#### Scenario: Full design of a fresh Change

- **WHEN** `/bdk:design add-csv-export` runs for a Change that has a `proposal.md` and no run files, with `policy.questions: decide-and-record` and `policy.gates.design: auto`
- **THEN** a `bdk:explorer` agent starts before a `bdk:designer` agent starts, the designer starts before a `bdk:verifier` agent starts, no `Agent` call sets `run_in_background: true`, and `.bdk/runs/add-csv-export/design/explore.md`, `openspec/changes/add-csv-export/design.md`, the spec delta and `.bdk/runs/add-csv-export/design/verify-1.md` exist

#### Scenario: Models of the design agents

- **WHEN** `/bdk:design add-csv-export` runs for a fresh Change with `models.explorer.model: sonnet`, `models.designer.effort: high` and `models.verifier.model: sonnet`
- **THEN** the `bdk:explorer` agent and the `bdk:verifier` agent both start with `model` `sonnet`, and the `bdk:designer` agent starts with `effort` `high`

### Requirement: Design gate by policy.gates.design

When the last report passes, the skill SHALL apply the design gate. With `policy.gates.design: auto` it SHALL approve the design without asking. With `manual` it SHALL end its turn on exactly one question: one `AskUserQuestion` call with the options to approve or to request changes, whose question text names `design.md`, the spec deltas, the passing report, the decisions taken without the user and every `Deviation:` line of `design.md`, with no reply text after it. A request for changes SHALL go to `design-draft` as a revision request, followed by a verifier pass within the same budget and the gate again. When `AskUserQuestion` is not available, the skill SHALL name the same files, decisions and deviations in its reply, end the reply with one line asking whether to approve the design or what to change, and end its turn without writing the gate file. On approval it SHALL write `.bdk/runs/<change>/design/gate.md` whose first line is `Gate: approved`, followed by `By: user` or `By: policy.gates.design auto`, and `Report: design/verify-N.md` naming the passing report.

#### Scenario: Automatic gate

- **WHEN** the last report passes and `policy.gates.design` is `auto`
- **THEN** no question is asked and `design/gate.md` starts with `Gate: approved` and names `By: policy.gates.design auto`

#### Scenario: Manual gate without a way to ask

- **WHEN** the last report passes, `policy.gates.design` is `manual`, and `AskUserQuestion` is not available
- **THEN** the reply names `design.md`, its last line asks the user to approve the design or say what to change, and no `design/gate.md` is written

#### Scenario: Changes requested at the gate

- **WHEN** at a manual gate the user asks to quote every label
- **THEN** `design-draft` revises the design with that request, a verifier pass writes the next `design/verify-N.md`, and the gate asks again after it passes

### Requirement: Report

The skill SHALL say, before each block runs, which block runs and which file it writes. It SHALL end with a short report: the files written in this run, the last verdict and the number of verifier passes used, every decision `design.md` marks `Decided without the user:`, every `Deviation:` line of `design.md` with the note that the tracking issue needs the same change, the gate's outcome, and, after an approval, the next stage `/bdk:plan <change>`.

#### Scenario: Report after an approved design

- **WHEN** the gate has approved the design of `add-csv-export`
- **THEN** the reply names `design.md`, the last `design/verify-N.md` with its verdict, `design/gate.md`, and `/bdk:plan add-csv-export` as the next stage

#### Scenario: Deviation in the report

- **WHEN** `design.md` holds a line `Deviation: the proposal's acceptance signal asks for a measurement - the user dropped it`
- **THEN** the gate question and the report both name that deviation, and the report says the tracking issue's acceptance signal needs the same change

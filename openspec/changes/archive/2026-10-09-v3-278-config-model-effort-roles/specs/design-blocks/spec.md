## MODIFIED Requirements

### Requirement: Agent blocks are started as agents and can be continued

`explore` SHALL run on the agent `bdk:explorer`, `design-draft` on the agent `bdk:designer` and `verify-design` on the agent `bdk:verifier`. A caller SHALL start such a block as an agent of that type whose prompt runs the block's skill with its arguments, so the caller receives the agent's ID and can continue the same agent with `SendMessage`. When a user invokes the skill in the main thread, the skill SHALL start its agent that way, with `model` and `effort` from `models.explorer`, `models.designer` or `models.verifier` as spec `bdk-cli/config` ("Every agent is a models role") says, wait for it, and reply with the agent's result; the main thread SHALL NOT do the block's work itself.

#### Scenario: Typed by the user

- **WHEN** a user types `/bdk:verify-design add-csv-export` in the main thread
- **THEN** a `bdk:verifier` agent writes `.bdk/runs/add-csv-export/design/verify-1.md`, and the main thread replies with its verdict line and the report path

#### Scenario: Typed by the user with a model set

- **WHEN** a user types `/bdk:explore add-csv-export` in the main thread of a project whose configuration sets `models.explorer.model: sonnet`
- **THEN** the skill starts the `bdk:explorer` agent with `model` `sonnet`

#### Scenario: Continued with SendMessage

- **WHEN** a caller started `verify-design` as a `bdk:verifier` agent, the report said `Verdict: FAIL`, the design was fixed, and the caller sends that agent a message to verify again
- **THEN** the same agent writes the next report `verify-2.md`

#### Scenario: Design draft on the designer

- **WHEN** a user types `/bdk:design-draft add-csv-export` with `models.designer.model: sonnet` and `models.designer.effort: high` and `policy.questions: decide-and-record`
- **THEN** a `bdk:designer` agent started with `model` `sonnet` and `effort` `high` writes `openspec/changes/add-csv-export/design.md`, and the main thread writes no spec delta and no `design.md` itself

### Requirement: Design draft writes the specs and the design

`design-draft` SHALL run in the `bdk:designer` agent. It SHALL read the Change's `proposal.md` and, when present, `.bdk/runs/<change>/design/explore.md`; without it, it SHALL read the code the proposal touches itself before asking anything. It SHALL write one spec delta per capability the proposal names and the Change's `design.md`, each following the instruction and template of the Change's OpenSpec schema. For each branching decision it SHALL weigh at least two approaches, or say why only one is viable, and `design.md` SHALL record each decision with its reason and the alternatives with why they lost, a Mermaid diagram for each flow or structure that prose alone leaves ambiguous, and risks naming at least one bottleneck, one single point of failure or operational risk, one hidden cost and one assumption the user did not confirm. It SHALL NOT write implementation code or plan parts.

#### Scenario: Specs and design written

- **WHEN** `design-draft` finishes for a Change whose proposal names the capability `ledger-export`
- **THEN** `openspec/changes/<change>/specs/ledger-export/spec.md` holds requirements with `#### Scenario:` blocks in WHEN / THEN form, and `openspec/changes/<change>/design.md` holds numbered decisions with alternatives and a Mermaid diagram

### Requirement: Questions follow the policy and the session

`design-draft` SHALL ask the user only what the proposal, the code and the project configuration leave open, all open questions in one round, each with the recommended answer first. With `policy.questions: decide-and-record` it SHALL ask nothing, take the recommended answers, and mark each such decision in `design.md` with the line `Decided without the user:` followed by the reason. Otherwise the designer SHALL ask through a Lavish page when `npx -y lavish-axi` opens one, and apply the feedback the page returns. When that command fails, the designer SHALL end its turn with the open questions listed, the recommended answer first, and write nothing; the main thread that started it SHALL ask them through `AskUserQuestion` and continue the same designer with the answers (`SendMessage`), or start a new designer whose arguments carry the answers. When `AskUserQuestion` is not available either, the main thread SHALL list the questions in its reply and end its turn. No spec delta and no `design.md` SHALL be written before the open questions are answered.

#### Scenario: Lavish opens

- **WHEN** `policy.questions` is `stop`, a decision is open, and `npx -y lavish-axi <page>` opens the page and its poll returns "use a semicolon as the delimiter"
- **THEN** the design and the spec delta use a semicolon as the delimiter

#### Scenario: Lavish cannot open

- **WHEN** `policy.questions` is `stop`, a decision is open, `npx -y lavish-axi <page>` exits non-zero, and `AskUserQuestion` is not available
- **THEN** the reply lists the open questions with the recommended answer first, and no `design.md` is written

#### Scenario: Answers through the main thread

- **WHEN** `policy.questions` is `stop`, a decision is open, `npx -y lavish-axi <page>` exits non-zero, and the main thread has `AskUserQuestion`
- **THEN** the main thread asks the designer's questions with `AskUserQuestion`, and the designer writes `design.md` with the answers the user chose

#### Scenario: Decide and record

- **WHEN** `policy.questions` is `decide-and-record` and a decision is open
- **THEN** no question is asked, `design.md` is written, and the decision carries a `Decided without the user:` line

## ADDED Requirements

### Requirement: Designer agent

The `bdk` plugin SHALL ship the agent `bdk:designer` (`agents/designer.md`), which runs the skill `bdk:design-draft` its prompt names with the `Skill` tool, with `model: inherit`, so that, with `models.designer` not set, the block runs on the session's model as it did in the main thread, and the tools `Read`, `Write`, `Edit`, `Bash`, `Grep`, `Glob` and `Skill`.

#### Scenario: Designer on the session's model

- **WHEN** `/bdk:design add-csv-export` drafts the design and the configuration sets nothing under `models.designer`
- **THEN** the `Agent` call that starts `bdk:designer` has neither `model` nor `effort`, and the designer runs on the session's model

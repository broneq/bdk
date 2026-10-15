## MODIFIED Requirements

### Requirement: The orchestrator only composes the design blocks

The skill SHALL run the design blocks in this order: `explore` as a `bdk:explorer` agent, `design-draft` as a `bdk:designer` agent whose prompt runs the skill `bdk:design-draft`, and `verify-design` as a `bdk:verifier` agent whose prompt runs the skill `bdk:verify-design`, each agent with `model` and `effort` from `models.explorer`, `models.designer` or `models.verifier` as spec `bdk-cli/config` ("Every agent is a models role") says. Every block SHALL start in the foreground (`run_in_background: false`) and the skill SHALL wait for its result before the next step; when an agent runs in the background anyway, the skill SHALL end its turn with one line naming the running block and resume from the run files when it is notified. When the designer ends with `Needs user: SL-<n>`, the skill SHALL stop as "Design gate by policy.gates.design" says. When the designer ends with open questions or with an open Lavish page, the skill SHALL ask them or poll the page as spec `design-blocks` ("Questions follow the policy and the session") says and pass the answers back to the designer. It SHALL NOT map the code, write or fix a spec delta, `design.md` or `proposal.md`, or check the design itself. The only files it SHALL write are the gate file `.bdk/runs/<change>/design/gate.md` and the index `.bdk/runs/<change>/explore/index.md`. It SHALL NOT commit, create a branch or start the plan stage.

#### Scenario: Full design of a fresh Change

- **WHEN** `/bdk:design add-csv-export` runs for a Change that has a `proposal.md` and no run files, with `policy.questions: decide-and-record` and `policy.gates.design: auto`
- **THEN** a `bdk:explorer` agent starts before a `bdk:designer` agent starts, the designer starts before a `bdk:verifier` agent starts, no `Agent` call sets `run_in_background: true`, and `.bdk/runs/add-csv-export/explore/design.md`, `openspec/changes/add-csv-export/design.md`, the spec delta and `.bdk/runs/add-csv-export/design/verify-1.md` exist

#### Scenario: Models of the design agents

- **WHEN** `/bdk:design add-csv-export` runs for a fresh Change with `models.explorer.model: sonnet`, `models.designer.effort: high` and `models.verifier.model: sonnet`
- **THEN** the `bdk:explorer` agent and the `bdk:verifier` agent both start with `model` `sonnet`, and the `bdk:designer` agent starts with `effort` `high`

### Requirement: Resume from the run files

The skill SHALL start at the first missing or open step, reading the run files of the Change: without `.bdk/runs/<change>/explore/design.md` and without `design.md` it SHALL start with `explore`; without `design.md` it SHALL start with `design-draft`; without a `design/verify-N.md` it SHALL start with `verify-design`; when the last report (highest N) says `Verdict: FAIL` it SHALL start with `design-draft` fixing that report; when the last report says `Verdict: PASS` it SHALL go to the gate. When `design/gate.md` says `Gate: approved` and no report is newer than it names, it SHALL run no block and report that the design is approved. A step whose file exists SHALL NOT run again. After `explore` writes its map, the skill SHALL build `explore/index.md` (spec `design-blocks`, "Explore directory and its index").

#### Scenario: Map already written

- **WHEN** `/bdk:design add-csv-export` runs and `.bdk/runs/add-csv-export/explore/design.md` exists without a `design.md`
- **THEN** no `bdk:explorer` agent starts and `design-draft` runs first

#### Scenario: Failed report waiting for a fix

- **WHEN** `/bdk:design add-csv-export` runs and the last report `design/verify-1.md` says `Verdict: FAIL`
- **THEN** no `bdk:explorer` agent starts, `design-draft` fixes the design before a `bdk:verifier` agent starts, and the next report is `design/verify-2.md`

#### Scenario: Designer needs the user

- **WHEN** `design-draft` ends with `Needs user: SL-2`
- **THEN** no `bdk:verifier` agent starts, no `design/gate.md` is written, and the reply names `SL-2` and that `/bdk:design <change>` in a session that can ask answers it

### Requirement: Design gate by policy.gates.design

When the last report passes, the skill SHALL apply the design gate. A **scope change to show** exists when `openspec/changes/<change>/scope-log.md` holds an entry whose `Stage` is not `propose` and whose number is above the `Scope log:` line of the last `design/gate.md` (above 0 without one). With a scope change to show, under `manual` and `auto` alike, the skill SHALL make sure `.bdk/runs/<change>/design/intent.html` exists and its `bdk-scope-log` meta names the log's last entry, running `design-draft` with `<change> intent page` when it does not, SHALL open it with `npx -y lavish-axi <page>` as a Bash command of its own, and SHALL ask the gate question naming the page and each entry to show. Without one, with `policy.gates.design: auto` it SHALL approve the design without asking. With `manual` it SHALL end its turn on exactly one question: one `AskUserQuestion` call with the options to approve or to request changes, whose question text names `design.md`, the spec deltas, the passing report, the decisions taken without the user, the scope changes to show with the intent page, and every `Deviation:` line of `design.md`, with no reply text after it. A request for changes SHALL go to `design-draft` as a revision request, followed by a verifier pass within the same budget and the gate again. When `AskUserQuestion` is not available, the skill SHALL name the same files, decisions, page and deviations in its reply, end the reply with one line asking whether to approve the design or what to change, and end its turn without writing the gate file. On approval it SHALL write `.bdk/runs/<change>/design/gate.md` whose first line is `Gate: approved`, followed by `By: user` or `By: policy.gates.design auto`, `Report: design/verify-N.md` naming the passing report, and `Scope log: SL-<n>` naming the last entry of the log, or `Scope log: none` without an entry.

#### Scenario: Automatic gate

- **WHEN** the last report passes, `policy.gates.design` is `auto`, and the scope log holds no entry after propose
- **THEN** no question is asked, no `design/intent.html` is written, and `design/gate.md` starts with `Gate: approved` and names `By: policy.gates.design auto`

#### Scenario: Manual gate without a way to ask

- **WHEN** the last report passes, `policy.gates.design` is `manual`, and `AskUserQuestion` is not available
- **THEN** the reply names `design.md`, its last line asks the user to approve the design or say what to change, and no `design/gate.md` is written

#### Scenario: Changes requested at the gate

- **WHEN** at a manual gate the user asks to quote every label
- **THEN** `design-draft` revises the design with that request, a verifier pass writes the next `design/verify-N.md`, and the gate asks again after it passes

#### Scenario: Scope changed at design

- **WHEN** the last report passes, `policy.gates.design` is `auto`, and `scope-log.md` holds an entry `SL-2` with `Stage: design` and `By: user` that changes `AC-2`
- **THEN** `design-draft` writes `design/intent.html`, a `lavish-axi` command opens it, the gate question names the page and `SL-2`, and after approval `design/gate.md` holds `Scope log: SL-2`

### Requirement: Orchestrator eval cases

`plugins/bdk/evals/` SHALL hold cases of `/bdk:design` tagged `orchestrator`, built on the shared ledger fixtures: a full design from a proposal with an automatic gate, a resume from a failed report, a manual gate in a session that cannot ask, and a gate with a scope change to show (`design-intent-page`: a passing design whose scope log holds an entry with `Stage: design` and `By: user` that changes an AC, graded on `design/intent.html` holding a struck intent, an AC table with before, after and the status `changed`, and the gate naming the page). Each SHALL hold `tool_order` graders for the order of the blocks and `file_exists` graders for the files the run writes, and their results SHALL be recorded in the Change.

#### Scenario: Orchestrator cases pass

- **WHEN** `pnpm --filter @bdk/bdk run eval --tag orchestrator --case 'design-*' --ablation none` runs with the grants of the eval README
- **THEN** every `tool_order` and `file_exists` grader of the `design-*` cases passes

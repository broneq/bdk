# Spec Delta

## MODIFIED Requirements

### Requirement: Pipeline file

The plugin SHALL ship `pipeline/pipeline.yaml`, and the kernel SHALL load it on every graph read through a strict schema that accepts exactly the keys below.

| Key                | Type                          | Req.     | Meaning                                                                                                                           |
| ------------------ | ----------------------------- | -------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `schema`           | integer                       | yes      | Version of this file's format; `1`.                                                                                               |
| `stages`           | array of `{id, command}`      | yes      | Stage ids in order (`intent`, `design`, `plan`, `execute`, `review`, `close`) and the stage command a user types (`/bdk:plan`).   |
| `nodes`            | array of node objects         | yes      | In pipeline order, which is also the order `next` walks.                                                                          |
| `nodes[].id`       | kebab-case, or `gate:<stage>` | yes      | Unique. A node whose kind expands into instances names the collection (`plan`); its instances are `<kind>:<nn>` (`plan-part:01`). |
| `nodes[].kind`     | a registered kind             | yes      | See Artifact kinds.                                                                                                               |
| `nodes[].stage`    | a stage id                    | yes      |                                                                                                                                   |
| `nodes[].requires` | array of node ids             | no       | Default empty. Every id names a node of the file; the graph is acyclic.                                                           |
| `nodes[].profiles` | array of `tiny, small, large` | no       | Default all. The node exists only for these effective profiles.                                                                   |
| `nodes[].kinds`    | array of `feature, bug`       | no       | Default all. The node exists only for these Change kinds.                                                                         |
| `nodes[].if`       | `features.<name>`             | no       | The node exists only while that boolean feature switch resolves to `true`; the name must be a declared `features` key.            |
| `nodes[].budget`   | a loop name                   | no       | One of `task-redispatch`, `verify-fix`, `review-fix`, `verifier`, `not-run`; the value lives in `policy.budgets` (read by T22).   |
| `nodes[].policy`   | a key of `policy.gates`       | for gate | The setting that says whether this gate is `manual` or `auto`.                                                                    |
| `nodes[].opens`    | a stage id                    | for gate | The stage whose command passes the gate; the gate's `command` is that stage's `command`.                                          |

The file SHALL hold no expression other than `if: features.<name>`, no loop construct and no path: which files a node reads or writes is decided by its kind, so the file cannot reference anything outside the Change directory. Anything that needs logic becomes a kind with tests. A shipped file that fails the schema is a kernel defect, not a refusal: the graph command crashes with exit 1 and a stack trace naming the key (`kernel-cli`, Exit codes and the error object), which the content test keeps from ever shipping. A content test runs the same schema on the shipped file and on negative fixtures. The build SHALL generate `schema/pipeline.json` (JSON Schema draft 2020-12) from that schema, like `schema/settings.json`, so the JSON Schema never drifts (git does not track it, `kernel-architecture`, Generated outputs) from the one the kernel enforces; the shipped file's first line is the modeline `# yaml-language-server: $schema=../schema/pipeline.json`, a relative path so editors validate against the schema of the same checkout.

#### Scenario: when is rejected

- **WHEN** the content test loads a pipeline fixture whose node carries `when: files.touched("src/billing/**")`
- **THEN** validation fails naming `nodes[<n>].when` as an unknown key

#### Scenario: expression in if

- **WHEN** a node carries `if: features.lavish && profile == large`
- **THEN** validation fails naming `if`, because only `features.<name>` is accepted

#### Scenario: unknown feature

- **WHEN** a node carries `if: features.unknown-switch`
- **THEN** validation fails naming the feature, because it is not a declared `features` key

#### Scenario: dangling or cyclic requires

- **WHEN** a node requires an id that no node has, or two nodes require each other
- **THEN** validation fails naming the node ids

#### Scenario: generated JSON Schema

- **WHEN** `pnpm build` runs and the shipped `pipeline/pipeline.yaml` and the fixture with `when:` are validated against `schema/pipeline.json`
- **THEN** the shipped file validates and the fixture fails on `when`

#### Scenario: shipped file is valid

- **WHEN** the content test loads the shipped `pipeline/pipeline.yaml`
- **THEN** it validates, every `kind` is registered, every gate has `policy` and `opens`, and every gate's `policy` is a declared `policy.gates` key

#### Scenario: rule category of the pack

- **WHEN** a node carries `rules: [code-quality, plan]`
- **THEN** validation fails naming `nodes[<n>].rules`: a node has no rule field, and the rules of its instruction follow from its `stage` (Instruction)

### Requirement: Instruction

`next` SHALL hand the ready node's instruction as Markdown with a fixed skeleton, built from the kind's template, the rules of the node's stage and a bounded ledger summary.

Sections in order: a heading naming the node id and kind; the kind's template, the resolved value of the prompt key `pipeline/<kind>` (`kernel-settings`, Prompt values), with `{change}`, `{node}`, `{profile}` and `{paths}` replaced; "Write to" with the paths the kind writes; "Rules" for a node of stage `design` or `plan`, the stages whose writer is the session itself: the Selection for the node's stage over the work tree files, in the line form of `ctx skill` (`kernel-cli/rules`, bdk rules show, Selection; `kernel-cli/ctx`, bdk ctx skill), omitted when nothing is selected; a node of `execute` or `review` has no "Rules" section, because its agents read their rules through their packages, and `intent` and `close` read none; "Ledger" with at most 20 entry summaries (accepted decisions, live questions and blockers, live `review: true` entries whose `refs` name the node or its files), newest first, one line each with id, type and summary, and a count of the omitted ones; "When finished" naming `bdk done <node id>`, or for an instance collection the instance ids. The same inputs, the work tree files among them, give the same bytes.

#### Scenario: deterministic instruction

- **WHEN** `bdk next` runs twice on an unchanged Change and an unchanged work tree
- **THEN** both instructions are byte-identical

#### Scenario: project extends the template

- **WHEN** `.bdk/prompts/pipeline/design.md` exists with `mode: extends`
- **THEN** the design instruction holds the plugin template followed by the project text

#### Scenario: ledger cap

- **WHEN** the Change holds 35 accepted decisions
- **THEN** the "Ledger" section lists 20 of them and says 15 are omitted

#### Scenario: execute node has no rules section

- **WHEN** `bdk next --json` returns a node of stage `execute`
- **THEN** its instruction has no "Rules" section

#### Scenario: design node lists the design stage rules

- **WHEN** the project holds `API-1` with `paths: ["**"]` and `stages: [design]`, and `bdk next --json` returns a node of stage `design`
- **THEN** the instruction's "Rules" section holds `- [API-1] <text>` and no `BDK-PL` rule

### Requirement: Plan stage nodes

The `plan` node of `pipeline/pipeline.yaml` SHALL have `stage: plan`, so its instruction lists the rules of the `plan` stage, among them the `BDK-PL` rules the planner ticks by id (Instruction). The `plan-verify` node SHALL require `plan`, `design`, `design-index` and `architecture`: a requirement absent or skipped in the Change's graph variant is satisfied, as for any node, so a `bug` Change still reaches `plan-verify` after `plan`; the verifier's package names the design documents that exist, because a package names the files of the node and of the nodes it requires; and the `fresh` check makes a verdict given before the design last changed fail. The instruction template of `plan-part` SHALL state the task shape (a contract with concrete test cases, no implementation code), the `isolation` and `isolation-reason` fields (`kernel-state`, Plan part and plan index) and that the spec deltas of `spec-impact` are written before `done`; the template of `plan-verify` SHALL name `/bdk:verify-plan`.

#### Scenario: plan instruction lists the plan rules

- **WHEN** `bdk next --json` returns the `plan` node of a `small` feature Change after `gate:design`
- **THEN** the instruction's "Rules" section lists `BDK-PL-1`, `BDK-PL-2`, `BDK-PL-3` and `BDK-PL-4`

#### Scenario: plan verifier reads the design

- **WHEN** `design`, `architecture` and every plan part are done, and `bdk dispatch build plan-verify verifier <ticket>` runs
- **THEN** the package names `design.md`, `architecture.md` and every plan part

#### Scenario: bug Change reaches plan-verify

- **WHEN** a `bug` Change of profile `small` has every plan part done
- **THEN** `bdk next --json` returns `plan-verify`, whose instruction names `/bdk:verify-plan`

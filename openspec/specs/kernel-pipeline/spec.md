# kernel-pipeline Specification

## Purpose

The artifact graph of a BDK v3 Change (Approach A): the shipped `pipeline.yaml` and its limits, the artifact kinds coded in the kernel, how node states, gates and graph variants are derived from the Change files and the ledger, and the instruction `next` hands to a stage skill.

## Requirements

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
| `nodes[].rules`    | array of rule categories      | no       | Rule sets the instruction carries, each a declared `rules/<category>` prompt key.                                                 |
| `nodes[].policy`   | a key of `policy.gates`       | for gate | The setting that says whether this gate is `manual` or `auto`.                                                                    |
| `nodes[].opens`    | a stage id                    | for gate | The stage whose command passes the gate; the gate's `command` is that stage's `command`.                                          |

The file SHALL hold no expression other than `if: features.<name>`, no loop construct and no path: which files a node reads or writes is decided by its kind, so the file cannot reference anything outside the Change directory. Anything that needs logic becomes a kind with tests. A shipped file that fails the schema is a kernel defect, not a refusal: the graph command crashes with exit 1 and a stack trace naming the key (`kernel-cli`, Exit codes and the error object), which the content test keeps from ever shipping. A content test runs the same schema on the shipped file and on negative fixtures. The build SHALL generate `schema/pipeline.json` (JSON Schema draft 2020-12) from that schema, like `schema/settings.json`, so the committed JSON Schema never drifts from the one the kernel enforces; the shipped file's first line is the modeline `# yaml-language-server: $schema=../schema/pipeline.json`, a relative path so editors validate against the schema of the same checkout.

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
- **THEN** `git diff --exit-code schema/` is clean, the shipped file validates and the fixture fails on `when`

#### Scenario: shipped file is valid

- **WHEN** the content test loads the shipped `pipeline/pipeline.yaml`
- **THEN** it validates, every `kind` is registered, every gate has `policy` and `opens`, and every gate's `policy` is a declared `policy.gates` key

### Requirement: Artifact kinds

The kernel SHALL implement every artifact kind as code that owns the kind's files, its hash inputs, whether it applies to a Change, whether it expands into instances, its validator, how it becomes done and its instruction template.

| Kind             | Files (under the Change directory)           | Instances           | Hash inputs                             | Done through                                                                             |
| ---------------- | -------------------------------------------- | ------------------- | --------------------------------------- | ---------------------------------------------------------------------------------------- |
| `intent`         | `change.md`                                  | no                  | `change.md`                             | construction: `change new` validates and writes it once, so the node is done from then   |
| `design`         | `design.md`                                  | no                  | `design.md`                             | `done`                                                                                   |
| `architecture`   | `architecture.md`                            | no                  | `architecture.md`                       | `done`                                                                                   |
| `design-part`    | `design/parts/<nn>-<slug>.md`                | one per design part | the part file                           | `done design-part:<nn>`                                                                  |
| `design-index`   | `design/index.md` (generated)                | no                  | every design part                       | `done`, which regenerates the index                                                      |
| `plan-part`      | `plan/parts/<nn>-<slug>.md`                  | one per plan part   | the part file                           | `done plan-part:<nn>`; `done plan` marks every ready part and regenerates the plan index |
| `plan-verify`    | verdict: the latest `report` naming the node | no                  | every plan part                         | `done`                                                                                   |
| `gate`           | none                                         | no                  | none (T1)                               | a qualifying `transition` entry (see Gate)                                               |
| `execute-part`   | commits of the part's tasks                  | one per plan part   | the plan part file                      | `part done`                                                                              |
| `post-task-step` | defined by T23                               | defined by T23      | defined by T23                          | the post-task step runner (T23)                                                          |
| `review`         | verdict: the latest `report` naming the node | no                  | the code tree of `HEAD` without `.bdk/` | `done`                                                                                   |
| `spec-delta`     | `spec-delta/<capability>.md`                 | no                  | every file of `spec-delta/`             | `done`                                                                                   |
| `close`          | the archived Change                          | no                  | none                                    | `change close` (T30)                                                                     |

A hash is `sha256:` over the listed files in path order, each contributing its path and its bytes, so a rename changes it. The validator of every kind checks at least that its files exist, are non-empty and validate against their `kernel-state` schema; `design` also refuses a `design.md` over 12 KB (T20 design D-11). `plan-part` runs the plan part checks of `kernel-loops`, Plan part checks. `execute-part` checks that the part is started, that every task of the part has a trailer commit (`kernel-loops`, Progress from git) and that no ticket of the part or its tasks is open; the graph reads the trailer commits and open tickets it needs from git and the index. A verdict kind (`plan-verify`, `review`) needs the latest `report` entry whose `refs` name the node, whose report file has `status: done` or `done-with-concerns`, and no live `blocker` entry naming the node. `architecture` applies unless the effective profile is `tiny` or `design.md` declares `architecture: false` (T02 decision R-5, product-only Change). `spec-delta` applies when any plan part declares a `spec-impact` other than `none`. An `execute-part` instance requires the `execute-part` instances of the plan parts its part `depends-on`. `bdk done` on a node of a kind done through another command (`intent`, `execute-part`, `post-task-step`, `close`) refuses with `policy/invalid-transition` naming that command. Later tasks add checks to a kind's validator (citations in T23, delta semantics in T30) without changing the graph commands.

#### Scenario: every kind is registered

- **WHEN** the kind registry is listed
- **THEN** it holds exactly the thirteen kinds of the table

#### Scenario: design over the limit

- **WHEN** `design.md` is 12 289 bytes and `bdk done design` runs
- **THEN** the exit code is 2 with `rule: policy/validation-failed`, the failing check is `size`, and `instead` names splitting into `design/parts/`

#### Scenario: product-only Change skips architecture

- **WHEN** a `small` feature Change's `design.md` declares `architecture: false`
- **THEN** the `architecture` node is `skipped` and `gate:design` requires only `design`

#### Scenario: verdict without report

- **WHEN** every plan part is done and `bdk done plan-verify` runs with no `report` entry naming `plan-verify`
- **THEN** the exit code is 2 with `rule: policy/validation-failed` naming the missing verdict

#### Scenario: execute-part without commits

- **WHEN** part `02` is started, task `02-1` has a trailer commit and `02-2` has none, and `bdk validate execute-part:02 --json` runs
- **THEN** `valid` is false and the failing check names `02-2`

### Requirement: Node states

The kernel SHALL derive every node's state on each read from the Change files and the ledger, never store it, and give each node exactly one of `blocked`, `ready`, `done`, `stale`, `skipped`.

- `skipped`: the node does not exist for this Change (its `profiles`, `kinds` or `if` exclude it, or its kind does not apply). A requirement on a skipped node is satisfied.
- `done`: the latest done marker of the node, a `transition` entry with `to: <node id>`, `source: kernel` and an `input-hash`, carries an `input-hash` equal to the node's current hash; a kernel `transition` without `input-hash` (the `part start` marker, a stage transition of `hooks prompt-expansion`) is not a done marker and changes no node state; a collection is done when it has at least one instance and every instance is done; `intent` is done once `change.md` exists; a gate follows the Gate requirement.
- `stale`: a done marker exists but its `input-hash` differs from the current hash (P2); a stale node is not done, and `explain` names the recorded and the current hash.
- `ready`: not done, not stale, and every requirement is done or skipped.
- `blocked`: otherwise; `why` names the first requirement that is not done.

A node is sealed while a gate that transitively requires it is done: `next` does not return a sealed node, and a sealed node that turns stale does not reopen its gate, so an edit after the gate is shown by `explain` and `change status` but blocks nothing (T1, risk "Gate binds to time, not content"). Marking a sealed node done again with a new hash is a loop-back (see Gate). `next` returns the first node in pipeline order, instances in id order, that is `ready` or `stale` and not sealed.

#### Scenario: edit after done

- **WHEN** `design` was marked done, `design.md` is edited afterwards, and `gate:design` is not done
- **THEN** `design` is `stale`, `next` returns `design`, and `explain design` names the recorded and the current hash

#### Scenario: done is idempotent

- **WHEN** `bdk done design` runs twice on an unchanged `design.md`
- **THEN** the second run exits 0 without writing an entry and returns the entry of the first run

#### Scenario: requirement not done

- **WHEN** `plan-verify` requires the plan collection and part `01` is ready but not done
- **THEN** `plan-verify` is `blocked` with `why` naming `plan-part:01`

#### Scenario: transition without a hash is not a done marker

- **WHEN** the ledger holds a kernel `transition` with `to: execute-part:02` and no `input-hash`, and part `02`'s requirements are done
- **THEN** `execute-part:02` is `ready`, not `done` or `stale`

### Requirement: Gate

A gate node SHALL be done only when the ledger holds a `transition` entry whose `gate` is the node id, whose `source` is `user` (or `policy` while the gate's `policy.gates.<gate>` resolves to `auto`), and whose `at` is not earlier than the gate's ready time (timestamps have one-second resolution, so the same second counts); the kernel SHALL never mark a gate done itself.

The ready time is the latest `at` among the `done` transitions that currently make the gate's requirements done; a gate whose requirements were never all done has none and is not done. The gate checks provenance and timing only: no content, no hash, no approval record. Entries of any other type, and transitions with another `source`, never pass a gate, whatever their summary says. `bdk done gate:<stage>` refuses with `policy/gate-not-ready`. A gate's status shows `ready`, `done`, `passedBy` (`user` or `policy`), the `command` from the stage its `opens` names, and the pending entries: live entries with `review: true`, newest first.

#### Scenario: user transition passes the gate

- **WHEN** `design` and `architecture` are done and a fixture inserts a `transition` with `gate: gate:design`, `to: plan` and `source: user` after them
- **THEN** `gate:design` is done with `passedBy: user` and `next` returns `plan`

#### Scenario: faked approval

- **WHEN** `bdk log add decision "Design approved" --ref gate:design` runs while `gate:design` is ready
- **THEN** `gate:design` stays ready and not done, and `next` still waits for the gate

#### Scenario: loop-back needs a newer entry

- **WHEN** `gate:design` was passed by a user transition, `design.md` is then changed and `bdk done design` records the new hash
- **THEN** `gate:design` is ready and not done until a user transition later than that `done` entry exists

#### Scenario: auto gate

- **WHEN** `policy.gates.design` resolves to `auto` and the ledger holds a `transition` with `gate: gate:design` and `source: policy` after the gate became ready
- **THEN** `gate:design` is done with `passedBy: policy`

#### Scenario: manual gate ignores policy entries

- **WHEN** `policy.gates.design` resolves to `manual` and the only transition naming the gate has `source: policy`
- **THEN** `gate:design` is not done

#### Scenario: early entry does not count

- **WHEN** a user transition naming `gate:design` is older than the `done` entry of `design`
- **THEN** `gate:design` is ready and not done

### Requirement: Graph variants

The shipped pipeline SHALL give each profile and Change kind the nodes below, selected by node fields only; the profile is the effective profile from the ledger (`kernel-state`, Derived state and mutation).

| Node                             | `tiny`                        | `small`             | `large`             | kind `bug`                            |
| -------------------------------- | ----------------------------- | ------------------- | ------------------- | ------------------------------------- |
| `intent`                         | yes                           | yes                 | yes                 | yes (the reproduction)                |
| `design`                         | no                            | yes                 | no                  | no                                    |
| `design-parts`, `design-index`   | no                            | no                  | yes                 | no                                    |
| `architecture`                   | no                            | unless product-only | unless product-only | no                                    |
| `gate:design`                    | no                            | yes                 | yes                 | no                                    |
| `plan` (plan parts)              | yes                           | yes                 | yes                 | yes (one part: failing test plus fix) |
| `plan-verify`                    | no                            | yes                 | yes                 | per profile                           |
| `execute` (execute parts)        | yes                           | yes                 | yes                 | yes                                   |
| `spec-delta`                     | when a part has `spec-impact` | same                | same                | same                                  |
| `review`, `gate:review`, `close` | yes                           | yes                 | yes                 | yes                                   |

When `bdk done design` runs on a `small` Change whose `design/parts/` holds parts and which has no `design.md`, the kernel writes a `decision` entry with `profile: large` (`source: kernel`, `refs: [design/parts/]`), the nodes are recomputed for `large`, and the output's `next` is the first design part.

#### Scenario: new small Change

- **WHEN** `bdk change new "Add passwordless login"` runs and then `bdk next --json`
- **THEN** `artifact.id` is `design`

#### Scenario: tiny has no design

- **WHEN** a Change is opened with `--profile tiny --reason "<why>"`
- **THEN** `change status --json` lists no `design`, `architecture`, `gate:design` or `plan-verify` node and `next` returns `plan`

#### Scenario: large Change

- **WHEN** a `large` feature Change has two design parts, both done, and `design-index` done
- **THEN** `change status` lists `design-part:01` and `design-part:02`, and `next` returns `architecture` before any plan node

#### Scenario: bug Change

- **WHEN** `bdk change new "Login fails after password reset" --kind bug` runs and then `bdk next --json`
- **THEN** `artifact.id` is `plan` with kind `plan-part`, and no design node exists

#### Scenario: design split raises the profile

- **WHEN** a `small` Change has `design/parts/01-auth.md` and `design/parts/02-mail.md`, no `design.md`, and `bdk done design` runs
- **THEN** a `decision` with `profile: large` is written, the effective profile is `large`, and `next` returns `design-part:01`

### Requirement: Instruction

`next` SHALL hand the ready node's instruction as Markdown with a fixed skeleton, built from the kind's template, the node's rule sets and a bounded ledger summary.

Sections in order: a heading naming the node id and kind; the kind's template, the resolved value of the prompt key `pipeline/<kind>` (`kernel-settings`, Prompt values), with `{change}`, `{node}`, `{profile}` and `{paths}` replaced; "Write to" with the paths the kind writes; "Rules" with each rule set the node's `rules` names, resolved as `ctx` resolves them; "Ledger" with at most 20 entry summaries (accepted decisions, live questions and blockers, live `review: true` entries whose `refs` name the node or its files), newest first, one line each with id, type and summary, and a count of the omitted ones; "When finished" naming `bdk done <node id>`, or for an instance collection the instance ids. The same inputs give the same bytes.

#### Scenario: deterministic instruction

- **WHEN** `bdk next` runs twice on an unchanged Change
- **THEN** both instructions are byte-identical

#### Scenario: project extends the template

- **WHEN** `.bdk/prompts/pipeline/design.md` exists with `mode: extends`
- **THEN** the design instruction holds the plugin template followed by the project text

#### Scenario: ledger cap

- **WHEN** the Change holds 35 accepted decisions
- **THEN** the "Ledger" section lists 20 of them and says 15 are omitted

### Requirement: Kind extensibility

A new artifact kind SHALL need only a kind implementation and a node in a pipeline file: `next`, `explain`, `validate`, `done`, `change status` and every skill SHALL work with it unchanged.

#### Scenario: fake kind

- **WHEN** a test registers a fake kind with its own file and validator and a test pipeline places its node after `intent`
- **THEN** `next` returns the fake node with its instruction, `validate` runs its validator, `done` records its hash, `explain` prints its chain and `change status` lists it, with no change to the code of those commands

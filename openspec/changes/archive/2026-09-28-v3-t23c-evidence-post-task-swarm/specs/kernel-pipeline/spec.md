# kernel-pipeline delta

## MODIFIED Requirements

### Requirement: Artifact kinds

The kernel SHALL implement every artifact kind as code that owns the kind's files, its hash inputs, whether it applies to a Change, whether it expands into instances, its validator, how it becomes done and its instruction template.

| Kind           | Files (under the Change directory)           | Instances           | Hash inputs                             | Done through                                                                             |
| -------------- | -------------------------------------------- | ------------------- | --------------------------------------- | ---------------------------------------------------------------------------------------- |
| `intent`       | `change.md`                                  | no                  | `change.md`                             | construction: `change new` validates and writes it once, so the node is done from then   |
| `design`       | `design.md`                                  | no                  | `design.md`                             | `done`                                                                                   |
| `architecture` | `architecture.md`                            | no                  | `architecture.md`                       | `done`                                                                                   |
| `design-part`  | `design/parts/<nn>-<slug>.md`                | one per design part | the part file                           | `done design-part:<nn>`                                                                  |
| `design-index` | `design/index.md` (generated)                | no                  | every design part                       | `done`, which regenerates the index                                                      |
| `plan-part`    | `plan/parts/<nn>-<slug>.md`                  | one per plan part   | the part file                           | `done plan-part:<nn>`; `done plan` marks every ready part and regenerates the plan index |
| `plan-verify`  | verdict: the latest `report` naming the node | no                  | every plan part                         | `done`                                                                                   |
| `gate`         | none                                         | no                  | none (T1)                               | a qualifying `transition` entry (see Gate)                                               |
| `execute-part` | commits of the part's tasks                  | one per plan part   | the plan part file                      | `part done`                                                                              |
| `simplify`     | the `simplify` manifests of the part         | one per plan part   | the tree hash of the part               | evidence: `attempt close ok` records it                                                  |
| `tests-scoped` | the `tests-scoped` manifests of the part     | one per plan part   | the tree hash of the part               | evidence: `bdk evidence record`                                                          |
| `lint`         | the `lint` manifests of the part             | one per plan part   | the tree hash of the part               | evidence: `bdk evidence record`                                                          |
| `review`       | verdict: the latest `report` naming the node | no                  | the code tree of `HEAD` without `.bdk/` | `done`                                                                                   |
| `spec-delta`   | `spec-delta/<capability>.md`                 | no                  | every file of `spec-delta/`             | `done`                                                                                   |
| `close`        | the archived Change                          | no                  | none                                    | `change close` (T30)                                                                     |

A hash is `sha256:` over the listed files in path order, each contributing its path and its bytes, so a rename changes it. The validator of every kind checks at least that its files exist, are non-empty and validate against their `kernel-state` schema; `design` also refuses a `design.md` over 12 KB (T20 design D-11). `plan-part` runs the plan part checks of `kernel-loops`, Plan part checks. `execute-part` checks that the part is started, that every task of the part has a trailer commit (`kernel-loops`, Progress from git) and that no ticket of the part or its tasks is open; the graph reads the trailer commits and open tickets it needs from git and the index. A verdict kind (`plan-verify`, `review`) needs the latest `report` entry whose `refs` name the node, whose report file has `status: done` or `done-with-concerns`, and no live `blocker` entry naming the node. `architecture` applies unless the effective profile is `tiny` or `design.md` declares `architecture: false` (T02 decision R-5, product-only Change). `spec-delta` applies when any plan part declares a `spec-impact` other than `none`. An `execute-part` instance requires the `execute-part` instances of the plan parts its part `depends-on`. `bdk done` on a node of a kind done through another command or through evidence (`intent`, `execute-part`, `simplify`, `tests-scoped`, `lint`, `close`) refuses with `policy/invalid-transition` naming that command. The post-task step kinds `simplify`, `tests-scoped` and `lint` share one `post-task-step` base (T23-D40): each is the evidence kind of the same name, run after every task inside the task's ticket (`kernel-cli/attempt`, `attempt close`) by its role, `simplifier` for `simplify` and `runner` for the other two; the order in which the orchestrator runs them is the order of their nodes in `pipeline.yaml`, never the skill's. A step node is done through evidence, not through a transition (user choice): a manifest covers part `<nn>` when its `target` is a task of the part, the part or the Change; the node's state follows the latest covering manifest of its kind (`kernel-state`, Evidence manifest), and a manifest is fresh when its `tree-hash` equals the current tree hash of its own target. An instance of a post-task step node requires the instance with its own number of each collection node it requires; any other instance requires a required collection whole. Its validator names the latest covering manifest, whether it is fresh and its verdict. A verdict kind (`plan-verify`, `review`) also checks the `evidence` ids its verdict report lists: each must name a manifest of the Change (`policy/validation-failed`), and a listed `pass` manifest without a citation is `policy/missing-citation` (T4). Later tasks add checks to a kind's validator (delta semantics in T30) without changing the graph commands.

#### Scenario: every kind is registered

- **WHEN** the kind registry is listed
- **THEN** it holds exactly the fifteen kinds of the table

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

#### Scenario: step node done from the latest fresh evidence

- **WHEN** tasks `02-1` and `02-2` each closed `ok` with a `tests-scoped` manifest and `02-2` changed a file of part `02` after the `02-1` manifest was recorded
- **THEN** `tests-scoped:02` is `done`, because the latest covering manifest is the fresh one of `02-2`

#### Scenario: done refused on a step node

- **WHEN** `bdk done tests-scoped:02` runs
- **THEN** the exit code is 2 with `rule: policy/invalid-transition` naming `bdk evidence record`

#### Scenario: step instances pair by part

- **WHEN** a Change has plan parts `01` and `02`
- **THEN** `tests-scoped:02` requires `simplify:02` and not `simplify:01`, and `review` requires every instance of `tests-scoped` and `lint`

#### Scenario: fake evidence kind

- **WHEN** a test registers a kind `contract-snapshot` on the `post-task-step` base, a test pipeline places its node after `execute`, and a ticket records a `contract-snapshot` manifest with `not-run` and then one with `pass` and a citation
- **THEN** the node is `done` after each record, `bdk done contract-snapshot:01` is refused, and a change to a `Files:` path of the part makes it `stale`

### Requirement: Node states

The kernel SHALL derive every node's state on each read from the Change files and the ledger, never store it, and give each node exactly one of `blocked`, `ready`, `done`, `stale`, `skipped`.

- `skipped`: the node does not exist for this Change (its `profiles`, `kinds` or `if` exclude it, or its kind does not apply). A requirement on a skipped node is satisfied.
- `done`: for a post-task step node, its latest covering manifest is fresh and says `pass` or `not-run` (Artifact kinds); for any other node, the latest done marker of the node, a `transition` entry with `to: <node id>`, `source: kernel` and an `input-hash`, carries an `input-hash` equal to the node's current hash; a kernel `transition` without `input-hash` (the `part start` marker, a stage transition of `hooks prompt-expansion`) is not a done marker and changes no node state; a collection is done when it has at least one instance and every instance is done; `intent` is done once `change.md` exists; a gate follows the Gate requirement.
- `stale`: a done marker exists but its `input-hash` differs from the current hash (P2), or, for a post-task step node, its latest covering manifest is not fresh; a stale node is not done, and `explain` names the recorded and the current hash.
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

#### Scenario: verdict for an older part hash is stale

- **WHEN** `plan-verify` was marked done on a verdict report and plan part `02` is edited afterwards
- **THEN** `plan-verify` is `stale`, not `done`, and `explain plan-verify` names the recorded and the current hash

#### Scenario: stale step evidence

- **WHEN** the latest `lint` manifest covering part `02` was recorded before a `Files:` path of the part changed
- **THEN** `lint:02` is `stale` and `next` returns it once its requirements are done

### Requirement: Graph variants

The shipped pipeline SHALL give each profile and Change kind the nodes below, selected by node fields only; the profile is the effective profile from the ledger (`kernel-state`, Derived state and mutation).

| Node                               | `tiny`                        | `small`             | `large`             | kind `bug`                            |
| ---------------------------------- | ----------------------------- | ------------------- | ------------------- | ------------------------------------- |
| `intent`                           | yes                           | yes                 | yes                 | yes (the reproduction)                |
| `design`                           | no                            | yes                 | no                  | no                                    |
| `design-parts`, `design-index`     | no                            | no                  | yes                 | no                                    |
| `architecture`                     | no                            | unless product-only | unless product-only | no                                    |
| `gate:design`                      | no                            | yes                 | yes                 | no                                    |
| `plan` (plan parts)                | yes                           | yes                 | yes                 | yes (one part: failing test plus fix) |
| `plan-verify`                      | no                            | yes                 | yes                 | per profile                           |
| `execute` (execute parts)          | yes                           | yes                 | yes                 | yes                                   |
| `simplify`, `tests-scoped`, `lint` | yes                           | yes                 | yes                 | yes                                   |
| `spec-delta`                       | when a part has `spec-impact` | same                | same                | same                                  |
| `review`, `gate:review`, `close`   | yes                           | yes                 | yes                 | yes                                   |

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

#### Scenario: steps follow execute

- **WHEN** a `small` Change has one plan part and `bdk change status --json` runs
- **THEN** the nodes `execute-part:01`, `simplify:01`, `tests-scoped:01` and `lint:01` appear in that order, before `spec-delta` and `review`

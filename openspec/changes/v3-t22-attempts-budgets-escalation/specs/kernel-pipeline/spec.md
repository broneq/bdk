## MODIFIED Requirements

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

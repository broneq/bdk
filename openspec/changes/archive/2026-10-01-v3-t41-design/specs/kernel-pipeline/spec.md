## MODIFIED Requirements

### Requirement: Artifact kinds

The kernel SHALL implement every artifact kind as code that owns the kind's files, its hash inputs, whether it applies to a Change, whether it expands into instances, its validator, how it becomes done and its instruction template.

| Kind            | Files (under the Change directory)           | Instances           | Hash inputs                                                            | Done through                                                                             |
| --------------- | -------------------------------------------- | ------------------- | ---------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `intent`        | `change.md`                                  | no                  | `change.md`                                                            | construction: `change new` validates and writes it once, so the node is done from then   |
| `design`        | `design.md`                                  | no                  | `design.md`                                                            | `done`                                                                                   |
| `architecture`  | `architecture.md`                            | no                  | `architecture.md`                                                      | `done`                                                                                   |
| `design-part`   | `design/parts/<nn>-<slug>.md`                | one per design part | the part file                                                          | `done design-part:<nn>`                                                                  |
| `design-index`  | `design/index.md` (generated)                | no                  | every design part                                                      | `done`, which regenerates the index                                                      |
| `plan-part`     | `plan/parts/<nn>-<slug>.md`                  | one per plan part   | the part file                                                          | `done plan-part:<nn>`; `done plan` marks every ready part and regenerates the plan index |
| `plan-verify`   | verdict: the latest `report` naming the node | no                  | every plan part                                                        | `done`                                                                                   |
| `design-verify` | verdict: the latest `report` naming the node | no                  | `design.md`, `architecture.md` and every design part, those that exist | `done`                                                                                   |
| `gate`          | none                                         | no                  | none (T1)                                                              | a qualifying `transition` entry (see Gate)                                               |
| `execute-part`  | commits of the part's tasks                  | one per plan part   | the plan part file                                                     | `part done`                                                                              |
| `simplify`      | the `simplify` manifests of the part         | one per plan part   | the tree hash of the part                                              | evidence: `attempt close ok` records it                                                  |
| `tests-scoped`  | the `tests-scoped` manifests of the part     | one per plan part   | the tree hash of the part                                              | evidence: `bdk evidence record`                                                          |
| `lint`          | the `lint` manifests of the part             | one per plan part   | the tree hash of the part                                              | evidence: `bdk evidence record`                                                          |
| `review`        | verdict: the latest `report` naming the node | no                  | the code tree of `HEAD` without `.bdk/`                                | `done`                                                                                   |
| `spec-delta`    | `spec-delta/<capability>.md`                 | no                  | every file of `spec-delta/`                                            | `done`                                                                                   |
| `close`         | the archived Change                          | no                  | none                                                                   | `change close` (T30)                                                                     |

A hash is `sha256:` over the listed files in path order, each contributing its path and its bytes, so a rename changes it. The validator of every kind checks at least that its files exist, are non-empty and validate against their `kernel-state` schema; `design` also refuses a `design.md` over 12 KB (T20 design D-11). `plan-part` runs the plan part checks of `kernel-loops`, Plan part checks. `execute-part` checks that the part is started, that every task of the part has a trailer commit (`kernel-loops`, Progress from git) and that no ticket of the part or its tasks is open; the graph reads the trailer commits and open tickets it needs from git and the index. A verdict kind (`design-verify`, `plan-verify`, `review`) needs the latest `report` entry whose `refs` name the node, whose report file has `status: done` or `done-with-concerns`, and no live `blocker` entry naming the node; that report's `at` SHALL NOT be earlier than the latest `done` transition of a node the verdict node requires (check `fresh`), so a verdict given before the verified artifact last changed never passes again. `architecture` applies unless the effective profile is `tiny` or `design.md` declares `architecture: false` (T02 decision R-5, product-only Change). `spec-delta` applies when any plan part declares a `spec-impact` other than `none`; its files are every `.md` file under `spec-delta/`, nested by capability path (`kernel-state`, Change directory layout), and its validator runs `spec delta check` on each (`kernel-cli/spec`): check `delta:<capability>` fails with rule `policy/spec-invalid` and `why` listing the problems, so `validate` answers `policy/spec-invalid` and `done` `policy/validation-failed`. An `execute-part` instance requires the `execute-part` instances of the plan parts its part `depends-on`. `bdk done` on a node of a kind done through another command or through evidence (`intent`, `execute-part`, `simplify`, `tests-scoped`, `lint`, `close`) refuses with `policy/invalid-transition` naming that command. The post-task step kinds `simplify`, `tests-scoped` and `lint` share one `post-task-step` base (T23-D40): each is the evidence kind of the same name, run after every task inside the task's ticket (`kernel-cli/attempt`, `attempt close`) by its role, `simplifier` for `simplify` and `runner` for the other two; the order in which the orchestrator runs them is the order of their nodes in `pipeline.yaml`, never the skill's. A step node is done through evidence, not through a transition (user choice): a manifest covers part `<nn>` when its `target` is a task of the part, the part or the Change; the node's state follows the latest covering manifest of its kind (`kernel-state`, Evidence manifest), and a manifest is fresh when its `tree-hash` equals the current tree hash of its own target. An instance of a post-task step node requires the instance with its own number of each collection node it requires; any other instance requires a required collection whole. Its validator names the latest covering manifest, whether it is fresh and its verdict. A verdict kind (`design-verify`, `plan-verify`, `review`) also checks the `evidence` ids its verdict report lists: each must name a manifest of the Change (`policy/validation-failed`), and a listed `pass` manifest without a citation is `policy/missing-citation` (T4). Later tasks add checks to a kind's validator without changing the graph commands, as T30 did with the delta semantics.

#### Scenario: every kind is registered

- **WHEN** the kind registry is listed
- **THEN** it holds exactly the sixteen kinds of the table

#### Scenario: design over the limit

- **WHEN** `design.md` is 12 289 bytes and `bdk done design` runs
- **THEN** the exit code is 2 with `rule: policy/validation-failed`, the failing check is `size`, and `instead` names splitting into `design/parts/`

#### Scenario: product-only Change skips architecture

- **WHEN** a `small` feature Change's `design.md` declares `architecture: false`
- **THEN** the `architecture` node is `skipped` and `gate:design` requires only `design` and `design-verify`

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

#### Scenario: delta semantics in the spec-delta node

- **WHEN** a part declares `spec-impact: [auth/login]`, `spec-delta/auth/login.md` holds a scenario without `- **WHEN**`, and `bdk validate spec-delta --json` runs
- **THEN** `valid` is false and check `delta:auth/login` fails naming `when-missing`; `bdk validate spec-delta` in text mode exits 2 with `rule: policy/spec-invalid`

#### Scenario: design verdict

- **WHEN** `design` and `architecture` are done and `bdk done design-verify` runs with no `report` entry naming `design-verify`
- **THEN** the exit code is 2 with `rule: policy/validation-failed` naming the missing verdict, and `gate:design` is not ready

#### Scenario: design change stales the verdict

- **WHEN** `design-verify` is done, `design.md` is then changed and `bdk done design` records the new hash
- **THEN** `design-verify` is `stale`, `gate:design` is not ready, and `bdk done design-verify` is refused with `policy/validation-failed` on check `fresh` until a passing report newer than that `done` entry names `design-verify`

### Requirement: Gate

A gate node SHALL be done only when the ledger holds a `transition` entry whose `gate` is the node id, whose `source` is `user` (or `policy` while the gate's `policy.gates.<gate>` resolves to `auto`), and whose `at` is not earlier than the gate's ready time (both truncated to the second, so a transition of the ready second counts, whatever its milliseconds); the kernel SHALL never mark a gate done itself.

The ready time is the latest `at` among the `done` transitions that currently make the gate's requirements done; a gate whose requirements were never all done has none and is not done. The gate checks provenance and timing only: no content, no hash, no approval record. Entries of any other type, and transitions with another `source`, never pass a gate, whatever their summary says. `bdk done gate:<stage>` refuses with `policy/gate-not-ready`. A gate's status shows `ready`, `done`, `passedBy` (`user` or `policy`), the `command` from the stage its `opens` names, and the pending entries: live entries with `review: true`, newest first.

#### Scenario: user transition passes the gate

- **WHEN** `design`, `architecture` and `design-verify` are done and a fixture inserts a `transition` with `gate: gate:design`, `to: plan` and `source: user` after them
- **THEN** `gate:design` is done with `passedBy: user` and `next` returns `plan`

#### Scenario: faked approval

- **WHEN** `bdk log add decision "Design approved" --ref gate:design` runs while `gate:design` is ready
- **THEN** `gate:design` stays ready and not done, and `next` still waits for the gate

#### Scenario: loop-back needs a newer entry

- **WHEN** `gate:design` was passed by a user transition, `design.md` is then changed, `bdk done design` records the new hash and a new passing verdict makes `design-verify` done again
- **THEN** `gate:design` is ready and not done until a user transition later than that `done` entry of `design-verify` exists

#### Scenario: auto gate

- **WHEN** `policy.gates.design` resolves to `auto` and the ledger holds a `transition` with `gate: gate:design` and `source: policy` after the gate became ready
- **THEN** `gate:design` is done with `passedBy: policy`

#### Scenario: manual gate ignores policy entries

- **WHEN** `policy.gates.design` resolves to `manual` and the only transition naming the gate has `source: policy`
- **THEN** `gate:design` is not done

#### Scenario: early entry does not count

- **WHEN** a user transition naming `gate:design` is older than the `done` entry of `design-verify`
- **THEN** `gate:design` is ready and not done

#### Scenario: transition of the ready second

- **WHEN** the gate became ready at `2026-09-25T09:41:07.800Z` and the user's `transition` has `at: 2026-09-25T09:41:07Z`
- **THEN** the gate is done

### Requirement: Graph variants

The shipped pipeline SHALL give each profile and Change kind the nodes below, selected by node fields only; the profile is the effective profile from the ledger (`kernel-state`, Derived state and mutation).

| Node                               | `tiny`                        | `small`             | `large`             | kind `bug`                            |
| ---------------------------------- | ----------------------------- | ------------------- | ------------------- | ------------------------------------- |
| `intent`                           | yes                           | yes                 | yes                 | yes (the reproduction)                |
| `design`                           | no                            | yes                 | no                  | no                                    |
| `design-parts`, `design-index`     | no                            | no                  | yes                 | no                                    |
| `architecture`                     | no                            | unless product-only | unless product-only | no                                    |
| `design-verify`                    | no                            | yes                 | yes                 | no                                    |
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
- **THEN** `change status --json` lists no `design`, `architecture`, `design-verify`, `gate:design` or `plan-verify` node and `next` returns `plan`

#### Scenario: large Change

- **WHEN** a `large` feature Change has two design parts, both done, and `design-index` done
- **THEN** `change status` lists `design-part:01` and `design-part:02`, and `next` returns `architecture`, then `design-verify`, before any plan node

#### Scenario: bug Change

- **WHEN** `bdk change new "Login fails after password reset" --kind bug` runs and then `bdk next --json`
- **THEN** `artifact.id` is `plan` with kind `plan-part`, and no design node exists

#### Scenario: design split raises the profile

- **WHEN** a `small` Change has `design/parts/01-auth.md` and `design/parts/02-mail.md`, no `design.md`, and `bdk done design` runs
- **THEN** a `decision` with `profile: large` is written, the effective profile is `large`, and `next` returns `design-part:01`

#### Scenario: steps follow execute

- **WHEN** a `small` Change has one plan part and `bdk change status --json` runs
- **THEN** the nodes `execute-part:01`, `simplify:01`, `tests-scoped:01` and `lint:01` appear in that order, before `spec-delta` and `review`

#### Scenario: design verification before the gate

- **WHEN** a `small` feature Change has `design` and `architecture` done and `bdk next --json` runs
- **THEN** `artifact.id` is `design-verify`, and `gate:design` requires `design`, `architecture` and `design-verify`

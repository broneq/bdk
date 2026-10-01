## ADDED Requirements

### Requirement: Plan stage nodes

The `plan` node of `pipeline/pipeline.yaml` SHALL carry `rules: [code-quality, architecture, test-quality, plan]`, so its instruction lists the `BDK-PL` rules the planner ticks by id. The `plan-verify` node SHALL require `plan`, `design`, `design-index` and `architecture`: a requirement absent or skipped in the Change's graph variant is satisfied, as for any node, so a `bug` Change still reaches `plan-verify` after `plan`; the verifier's package names the design documents that exist, because a package names the files of the node and of the nodes it requires; and the `fresh` check makes a verdict given before the design last changed fail. The instruction template of `plan-part` SHALL state the task shape (a contract with concrete test cases, no implementation code) and that the spec deltas of `spec-impact` are written before `done`; the template of `plan-verify` SHALL name `/bdk:verify-plan`.

#### Scenario: plan instruction lists the plan rules

- **WHEN** `bdk next --json` returns the `plan` node of a `small` feature Change after `gate:design`
- **THEN** the instruction's "Rules" section lists `BDK-PL-1`, `BDK-PL-2` and `BDK-PL-3`

#### Scenario: plan verifier reads the design

- **WHEN** `design`, `architecture` and every plan part are done, and `bdk dispatch build plan-verify verifier <ticket>` runs
- **THEN** the package names `design.md`, `architecture.md` and every plan part

#### Scenario: bug Change reaches plan-verify

- **WHEN** a `bug` Change of profile `small` has every plan part done
- **THEN** `bdk next --json` returns `plan-verify`, whose instruction names `/bdk:verify-plan`

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
| `plan-verify`   | verdict: the latest `report` naming the node | no                  | every plan part and every file of `spec-delta/`                        | `done`                                                                                   |
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

#### Scenario: spec delta change stales the plan verdict

- **WHEN** `plan-verify` is done and `spec-delta/ui-format.md`, which a plan part names in `spec-impact`, is then edited
- **THEN** `plan-verify` is `stale`, and `explain plan-verify` names the recorded and the current hash

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
| `nodes[].budget`   | a loop name                   | no       | One of `part`, `verify-fix`, `review-fix`, `verifier`, `not-run`; the value lives in `policy.budgets` (read by T22).              |
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

### Requirement: Artifact kinds

The kernel SHALL implement every artifact kind as code that owns the kind's files, its hash inputs, whether it applies to a Change, whether it expands into instances, its validator, how it becomes done and its instruction template.

| Kind            | Files (under the Change directory)                      | Instances           | Hash inputs                                                            | Done through                                                                             |
| --------------- | ------------------------------------------------------- | ------------------- | ---------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `intent`        | `change.md`                                             | no                  | `change.md`                                                            | construction: `change new` validates and writes it once, so the node is done from then   |
| `design`        | `design.md`                                             | no                  | `design.md`                                                            | `done`                                                                                   |
| `architecture`  | `architecture.md`                                       | no                  | `architecture.md`                                                      | `done`                                                                                   |
| `design-part`   | `design/parts/<nn>-<slug>.md`                           | one per design part | the part file                                                          | `done design-part:<nn>`                                                                  |
| `design-index`  | `design/index.md` (generated)                           | no                  | every design part                                                      | `done`, which regenerates the index                                                      |
| `plan-part`     | `plan/parts/<nn>-<slug>.md`                             | one per plan part   | the part file                                                          | `done plan-part:<nn>`; `done plan` marks every ready part and regenerates the plan index |
| `plan-verify`   | verdict: the latest `report` naming the node            | no                  | every plan part and every file of `spec-delta/`                        | `done`                                                                                   |
| `design-verify` | verdict: the latest `report` naming the node            | no                  | `design.md`, `architecture.md` and every design part, those that exist | `done`                                                                                   |
| `gate`          | none                                                    | no                  | none (T1)                                                              | a qualifying `transition` entry (see Gate)                                               |
| `execute-part`  | commits of the part's tasks                             | one per plan part   | the plan part file                                                     | `part done`                                                                              |
| `conform`       | the `conform` manifests of the part                     | one per plan part   | the tree hash of the part                                              | evidence: `attempt close ok` records it from the conformer's report                      |
| `tests-scoped`  | the `tests-scoped` manifests of the part                | one per plan part   | the tree hash of the part                                              | evidence: `bdk check run`                                                                |
| `lint`          | the `lint` manifests of the part                        | one per plan part   | the tree hash of the part                                              | evidence: `bdk check run`                                                                |
| `tests-full`    | the `tests-full` and `coverage` manifests of the Change | no                  | the tree hash of the Change                                            | evidence: `bdk evidence record`, `bdk evidence coverage`                                 |
| `lint-full`     | the `lint-full` manifests of the Change                 | no                  | the tree hash of the Change                                            | evidence: `bdk evidence record`                                                          |
| `review`        | verdict: the latest `report` naming the node            | no                  | the code tree of `HEAD` without `.bdk/`                                | `done`                                                                                   |
| `spec-delta`    | `spec-delta/<capability>.md`                            | no                  | every file of `spec-delta/`                                            | `done`                                                                                   |
| `close`         | the archived Change                                     | no                  | none                                                                   | `change close` (T30)                                                                     |

A hash is `sha256:` over the listed files in path order, each contributing its path and its bytes, so a rename changes it. The validator of every kind checks at least that its files exist, are non-empty and validate against their `kernel-state` schema; `design` also refuses a `design.md` over 12 KB (T20 design D-11). `plan-part` runs the plan part checks of `kernel-loops`, Plan part checks. `execute-part` checks that the part is started, that every task of the part has a trailer commit (`kernel-loops`, Progress from git) and that no ticket of the part or its tasks is open; the graph reads the trailer commits and open tickets it needs from git and the index. A verdict kind (`design-verify`, `plan-verify`, `review`) needs the latest `report` entry whose `refs` name the node, whose report file has `status: done` or `done-with-concerns`, and no live `blocker` entry naming the node; that report's `at` SHALL NOT be earlier than the latest `done` transition of a node the verdict node requires (check `fresh`), so a verdict given before the verified artifact last changed never passes again. The `review` verdict adds four checks (T42): the report entry must carry `group: merge` and a `ticket` of loop `review-fix` (check `merge-report`), so one reviewer of a parallel round never decides the verdict alone; that ticket must be closed `ok` (check `round-ok`), so a round that is still open, failed or could not run decides nothing; every `finding`, `blocker` and `observation` written under that ticket must carry a `level` or be resolved (check `triaged`, `kernel-cli/log`, bdk log triage); and no live entry of the Change may carry `level: blocker` (check `blockers`), whichever ticket wrote it. The change-level check kinds `tests-full` and `lint-full` share one `change-check` base: one node each, target the Change id, done through evidence like a post-task step, from the latest manifest of the kind recorded under a ticket of the Change whose tree hash equals the current tree hash of the Change and whose verdict is `pass` or `not-run`; `tests-full` additionally needs, for every `tools.test` entry with `coverage.min`, a fresh `coverage` manifest with that `tool` and verdict `pass` (`kernel-cli/evidence`, bdk evidence coverage). A `fail` manifest leaves the node not done, and `explain` names the manifest. `architecture` applies unless the effective profile is `tiny` or `design.md` declares `architecture: false` (T02 decision R-5, product-only Change). `spec-delta` applies when any plan part declares a `spec-impact` other than `none`; its files are every `.md` file under `spec-delta/`, nested by capability path (`kernel-state`, Change directory layout), and its validator runs `spec delta check` on each (`kernel-cli/spec`): check `delta:<capability>` fails with rule `policy/spec-invalid` and `why` listing the problems, so `validate` answers `policy/spec-invalid` and `done` `policy/validation-failed`. An `execute-part` instance requires the `execute-part` instances of the plan parts its part `depends-on`. `bdk done` on a node of a kind done through another command or through evidence (`intent`, `execute-part`, `conform`, `tests-scoped`, `lint`, `tests-full`, `lint-full`, `close`) refuses with `policy/invalid-transition` naming that command. The post-task step kinds `conform`, `tests-scoped` and `lint` share one `post-task-step` base (T23-D40): each is the evidence kind of the same name, run for the part inside its `part` or `verify-fix` ticket (`kernel-cli/attempt`, `attempt close`): `conform` by the `conformer` agent, whose report the kernel records at the close, `tests-scoped` and `lint` by the kernel itself in `bdk check run` (`kernel-cli/check`; #166), which the part's agents run; the order in which the orchestrator runs them is the order of their nodes in `pipeline.yaml`, never the skill's. A step node is done through evidence, not through a transition (user choice): a manifest covers part `<nn>` when its `target` is a task of the part, the part or the Change; the node's state follows the latest covering manifest of its kind (`kernel-state`, Evidence manifest), and a manifest is fresh when its `tree-hash` equals the current tree hash of its own target. An instance of a post-task step node requires the instance with its own number of each collection node it requires; any other instance requires a required collection whole. Its validator names the latest covering manifest, whether it is fresh and its verdict. A verdict kind (`design-verify`, `plan-verify`, `review`) also checks the `evidence` ids its verdict report lists: each must name a manifest of the Change (`policy/validation-failed`), and a listed `pass` manifest without a citation is `policy/missing-citation` (T4). Later tasks add checks to a kind's validator without changing the graph commands, as T30 did with the delta semantics.

#### Scenario: every kind is registered

- **WHEN** the kind registry is listed
- **THEN** it holds exactly the eighteen kinds of the table

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

- **WHEN** `bdk check run 02-1` recorded a `tests-scoped` manifest of task `02-1`, task `02-2` then changed a file of part `02`, and `bdk check run 02` recorded a passing manifest of the part
- **THEN** `tests-scoped:02` is `done`, because the latest covering manifest is the fresh one of the part

#### Scenario: done refused on a step node

- **WHEN** `bdk done tests-scoped:02` runs
- **THEN** the exit code is 2 with `rule: policy/invalid-transition` naming `bdk check run`

#### Scenario: step instances pair by part

- **WHEN** a Change has plan parts `01` and `02`
- **THEN** `tests-scoped:02` requires `conform:02` and not `conform:01`, and `review` requires every instance of `tests-scoped` and `lint`

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

#### Scenario: review needs the merged report

- **WHEN** the reviewer of group `p01` recorded a `report` entry naming `review` under `A-r1v2w3x4@p01`, and no `merge` report exists
- **THEN** `bdk done review` is refused with `policy/validation-failed` on check `merge-report`

#### Scenario: review waits for its round to close ok

- **WHEN** the merged report of a `review-fix` ticket is stored with every entry triaged, the ticket is still open, and `bdk done review` runs
- **THEN** the exit code is 2 with `rule: policy/validation-failed`, `why` names check `round-ok` and the ticket, and after `bdk attempt close <ticket> ok` the same `bdk done review` passes

#### Scenario: untriaged finding blocks the verdict

- **WHEN** the `merge` report of ticket `A-r1v2w3x4` is recorded and a live finding of group `p02` of that ticket has no `level`
- **THEN** `bdk done review` is refused with `policy/validation-failed` on check `triaged`, naming the entry

#### Scenario: triaged blocker blocks the verdict

- **WHEN** an execute-stage finding was triaged `blocker` and is still live when the `merge` report is recorded
- **THEN** `bdk done review` is refused with `policy/validation-failed` on check `blockers`, naming the entry, and passes once the entry is resolved

#### Scenario: review requires the full gate

- **WHEN** every post-task step and `spec-delta` are done and no `tests-full` manifest exists
- **THEN** `review` is not ready and `explain review` names `tests-full`

#### Scenario: coverage below the threshold keeps tests-full open

- **WHEN** `unit` has `coverage.min: 90`, a fresh `tests-full` manifest passes and the fresh `coverage` manifest of `unit` has `verdict: fail`
- **THEN** `tests-full` is not done and `explain tests-full` names the coverage manifest

#### Scenario: a fix stales the full gate

- **WHEN** `tests-full` and `lint-full` are done and a fix commit changes a file of part `02`
- **THEN** both nodes are `stale` until new manifests are recorded

#### Scenario: done refused on the full gate

- **WHEN** `bdk done lint-full` runs
- **THEN** the exit code is 2 with `rule: policy/invalid-transition` naming `bdk evidence record`

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

### Requirement: Gate

A gate node SHALL be done only when the ledger holds a `transition` entry whose `gate` is the node id, whose `source` is `user` (or `policy` while the gate's `policy.gates.<gate>` resolves to `auto`, or `policy` with `auto: true`, which only the hooks write for a run started with `--auto`, T41), and whose `at` is not earlier than the gate's ready time (both truncated to the second, so a transition of the ready second counts, whatever its milliseconds); the kernel SHALL never mark a gate done itself.

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

- **WHEN** `policy.gates.design` resolves to `manual` and the only transition naming the gate has `source: policy` and no `auto`
- **THEN** `gate:design` is not done

#### Scenario: run with --auto passes a manual gate

- **WHEN** `policy.gates.design` resolves to `manual` and the ledger holds a `transition` with `gate: gate:design`, `source: policy` and `auto: true` after the gate became ready
- **THEN** `gate:design` is done with `passedBy: policy`

#### Scenario: early entry does not count

- **WHEN** a user transition naming `gate:design` is older than the `done` entry of `design-verify`
- **THEN** `gate:design` is ready and not done

#### Scenario: transition of the ready second

- **WHEN** the gate became ready at `2026-09-25T09:41:07.800Z` and the user's `transition` has `at: 2026-09-25T09:41:07Z`
- **THEN** the gate is done

### Requirement: Graph variants

The shipped pipeline SHALL give each profile and Change kind the nodes below, selected by node fields only; the profile is the effective profile from the ledger (`kernel-state`, Derived state and mutation).

| Node                              | `tiny`                        | `small`             | `large`             | kind `bug`                            | kind `review`           |
| --------------------------------- | ----------------------------- | ------------------- | ------------------- | ------------------------------------- | ----------------------- |
| `intent`                          | yes                           | yes                 | yes                 | yes (the reproduction)                | yes (the review intent) |
| `design`                          | no                            | yes                 | no                  | no                                    | no                      |
| `design-parts`, `design-index`    | no                            | no                  | yes                 | no                                    | no                      |
| `architecture`                    | no                            | unless product-only | unless product-only | no                                    | no                      |
| `design-verify`                   | no                            | yes                 | yes                 | no                                    | no                      |
| `gate:design`                     | no                            | yes                 | yes                 | no                                    | no                      |
| `plan` (plan parts)               | yes                           | yes                 | yes                 | yes (one part: failing test plus fix) | no                      |
| `plan-verify`                     | no                            | yes                 | yes                 | per profile                           | no                      |
| `execute` (execute parts)         | yes                           | yes                 | yes                 | yes                                   | no                      |
| `conform`, `tests-scoped`, `lint` | yes                           | yes                 | yes                 | yes                                   | no                      |
| `spec-delta`                      | when a part has `spec-impact` | same                | same                | same                                  | no                      |
| `tests-full`, `lint-full`         | yes                           | yes                 | yes                 | yes                                   | yes                     |
| `review`, `gate:review`, `close`  | yes                           | yes                 | yes                 | yes                                   | yes                     |

A `review` Change (`kernel-cli/change`, bdk change new; T42) reviews work already on its branch: it has no design, plan or execute node, so its first actionable node is `tests-full` and `bdk next` names `/bdk:cr`; the `review` node's other requirements are absent and count as met.

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
- **THEN** the nodes `execute-part:01`, `conform:01`, `tests-scoped:01` and `lint:01` appear in that order, before `spec-delta`, `tests-full`, `lint-full` and `review`

#### Scenario: design verification before the gate

- **WHEN** a `small` feature Change has `design` and `architecture` done and `bdk next --json` runs
- **THEN** `artifact.id` is `design-verify`, and `gate:design` requires `design`, `architecture` and `design-verify`

#### Scenario: review Change

- **WHEN** `bdk change new "Review the login branch" --inferred --kind review` runs and then `bdk change status --json`
- **THEN** the nodes are `intent`, `tests-full`, `lint-full`, `review`, `gate:review` and `close`, and `bdk next --json` returns a review-stage node whose `command` is `/bdk:cr`

### Requirement: Instruction

`next` SHALL hand the ready node's instruction as Markdown with a fixed skeleton, built from the kind's template, the rules of the node's stage and a bounded ledger summary.

Sections in order: a heading naming the node id and kind; the kind's template, the resolved value of the prompt key `pipeline/<kind>` (`kernel-settings`, Prompt values), with `{change}`, `{node}`, `{profile}`, `{paths}`, `{max-tasks}` and `{max-files}` (`plan.part`, #166) replaced; "Write to" with the paths the kind writes; "Rules" for a node of stage `design` or `plan`, the stages whose writer is the session itself: the Selection for the node's stage over the work tree files, in the line form of `ctx skill` (`kernel-cli/rules`, bdk rules show, Selection; `kernel-cli/ctx`, bdk ctx skill), omitted when nothing is selected; a node of `execute` or `review` has no "Rules" section, because its agents read their rules through their packages, and `intent` and `close` read none; "Ledger" with at most 20 entry summaries (accepted decisions, live questions and blockers, live `review: true` entries whose `refs` name the node or its files), newest first, one line each with id, type and summary, and a count of the omitted ones; "When finished" naming `bdk done <node id>`, or for an instance collection the instance ids. The same inputs, the work tree files among them, give the same bytes.

#### Scenario: deterministic instruction

- **WHEN** `bdk next` runs twice on an unchanged Change and an unchanged work tree
- **THEN** both instructions are byte-identical

#### Scenario: project extends the template

- **WHEN** `.bdk/prompts/pipeline/design.md` exists with `mode: extends`
- **THEN** the design instruction holds the plugin template followed by the project text

#### Scenario: plan part limits in the plan instruction

- **WHEN** `.bdk/settings.yaml` sets `plan.part.max-tasks: 3` and `plan.part.max-files: 7` and `next` returns a `plan-part` node
- **THEN** its instruction says at most 3 tasks, 7 distinct `Files:` paths and 8 KB per part, and holds no `{max-tasks}` or `{max-files}`

#### Scenario: ledger cap

- **WHEN** the Change holds 35 accepted decisions
- **THEN** the "Ledger" section lists 20 of them and says 15 are omitted

#### Scenario: execute node has no rules section

- **WHEN** `bdk next --json` returns a node of stage `execute`
- **THEN** its instruction has no "Rules" section

#### Scenario: design node lists the design stage rules

- **WHEN** the project holds `API-1` with `paths: ["**"]` and `stages: [design]`, and `bdk next --json` returns a node of stage `design`
- **THEN** the instruction's "Rules" section holds `- [API-1] <text>` and no `BDK-PL` rule

### Requirement: Kind extensibility

A new artifact kind SHALL need only a kind implementation and a node in a pipeline file: `next`, `explain`, `validate`, `done`, `change status` and every skill SHALL work with it unchanged.

#### Scenario: fake kind

- **WHEN** a test registers a fake kind with its own file and validator and a test pipeline places its node after `intent`
- **THEN** `next` returns the fake node with its instruction, `validate` runs its validator, `done` records its hash, `explain` prints its chain and `change status` lists it, with no change to the code of those commands

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

### Requirement: Tool group nodes

The kinds `tests-scoped` and `tests-full` SHALL belong to the tool group `test`, and `lint` and `lint-full` to the tool group `lint` (`kernel-settings`, Tool entries, Tool group states). A node of a grouped kind SHALL be `skipped` when its group is declared none, with `why: tools.<group> is none` and, for a step collection, no instance, so that a requirement on it is satisfied (Requirement: Node states), `bdk check run` does not run it (`kernel-cli/check`), the review round's gate runner does not list it (`kernel-cli/dispatch`, bdk dispatch build) and `attempt close` does not ask for its evidence. No `not-run` manifest is ever needed for a declared-none group. A configured group's nodes apply as before. An unset group's nodes apply as well, but a Change never reaches them: `bdk change new` and `bdk part start` refuse an unset group with `policy/tools-unset` (`kernel-cli/change`, bdk change new; `kernel-cli/part`, bdk part start). The groups a Change runs are those of the grouped nodes its graph variant applies: with the shipped pipeline every kind runs both groups, through `tests-full` and `lint-full`.

#### Scenario: lint declared none

- **WHEN** `tools.lint` is `none`, `tools.test` is configured, and a `small` feature Change has plan part `01`
- **THEN** `change status --json` lists `lint` and `lint-full` as `skipped` with `why` naming `tools.lint is none` and no `lint:01` instance, `tests-scoped:01` and `tests-full` are not skipped, and `review` lists neither `lint-full` nor a `lint` instance among its requirements

#### Scenario: no lint step in the checks

- **WHEN** `tools.lint` is `none` and `bdk check run 01 --ticket <ticket>` runs
- **THEN** it runs and records `tests-scoped` only, and `attempt close <ticket> ok` succeeds with the conformer's report, a passing `tests-scoped` manifest and no `lint` manifest

#### Scenario: test declared none

- **WHEN** `tools.test` is `none`
- **THEN** `tests-scoped` and `tests-full` are `skipped` with `why` naming `tools.test is none`, and `tests-scoped` has no instance

#### Scenario: no lint step in the runner's checks

- **WHEN** `tools.lint` is `none` and the gate runner package of a review round is built
- **THEN** its `Checks` section holds `tests-full` and no `lint-full` section

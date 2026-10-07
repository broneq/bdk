# Spec Delta

## MODIFIED Requirements

### Requirement: Generated outputs

Every file that `pnpm build` generates SHALL be ignored and untracked on every branch except the distribution ref, and one contract test SHALL keep the ignore list and the generators in step.

Generated files: `dist/bdk.mjs`; under `schema/`, `settings.json`, `pipeline.json`, `state/`, `cli/output/` and the generated files of `cli/common/` (`version.json`, `refusal.json`); under `agents/`, the adapters of `bdk export agents --host claude` (`integrator`, `judge`, `lead`, `reader`, `reviewer`, `runner`, `scout`, `worker`). Hand-written files stay tracked: `schema/cli/commands.json`, `schema/cli/commands.schema.json`, `schema/cli/common/list-page.json` and `agents/web-researcher.md`, the one hand-written agent next to the adapters since T42 removed the v2 agents. `.gitignore` names each generated path (a directory where the whole directory is generated); the adapters are covered by `/agents/*` with `agents/web-researcher.md` excepted. `pnpm build` runs the bundler, the schema exporter and `export agents --host claude`, in that order, from one command, so `prepare`, CI and the release job all produce the same set. The contract test runs the exporters into a temporary directory, lists every file they write, and fails when one of those paths is tracked or is not covered by `.gitignore`, and when `git ls-files` on any generated path is non-empty (it skips this second check when HEAD is the distribution ref).

#### Scenario: new generated file without an ignore entry

- **WHEN** the schema exporter starts writing `schema/state/new-kind.json` into a directory that `.gitignore` does not cover, or writes a file into a new directory
- **THEN** the contract test fails naming the path

#### Scenario: generated file forced into git

- **WHEN** a branch other than the distribution ref tracks `schema/settings.json`
- **THEN** the contract test fails naming it

#### Scenario: hand-written schema stays tracked

- **WHEN** `schema/cli/commands.json` is edited
- **THEN** the change shows in the diff of the pull request and no generator overwrites it

#### Scenario: one build command

- **WHEN** `pnpm build` runs in a clean checkout
- **THEN** it writes `dist/bdk.mjs`, every generated file under `schema/` and the eight adapters under `agents/`, and a second run changes none of them

### Requirement: Distribution ref

The release workflow SHALL, when release-please creates a release, build from the tagged commit and publish the tagged tree plus the generated outputs to the `release` branch, tag that commit `dist-v<version>`, and the `bdk` entry of the marketplace SHALL install the plugin from the `release` branch.

The job checks out the release tag, runs the frozen install and `pnpm build`, force-adds `dist/`, `schema/` and `agents/` (`git add -f`: whole generated directories, so no list of files exists to drift), commits them (`chore(release): bundle <tag>`), force-pushes the commit to `release` and tags it `dist-v<version>`. `release` holds one commit per release and never merges with `main`. The tag is what the settings modeline points at (`kernel-settings`, Settings JSON Schema), so a schema URL is pinned to the kernel version that wrote it; release-please's own tag `v<version>` stays on `main`. The `bdk` entry of `.claude-plugin/marketplace.json` is a `github` plugin source with `repo: broneq/bdk` and `ref: release` (plugins reference, Plugin sources). Installed copies update because release-please bumps `version` in `.claude-plugin/plugin.json` on every release. A push to `main` that creates no release publishes nothing; a job failure leaves `release` at the previous release, which stays installable. A `workflow_dispatch` input `tag` runs the same job for an existing tag.

#### Scenario: release publishes the generated outputs

- **WHEN** release-please creates release `v3.0.1`
- **THEN** `release` points to a commit whose tree is the tree of `v3.0.1` plus `dist/bdk.mjs`, `schema/` and the eight adapters, each equal to a fresh `pnpm build` of the tag, and the tag `dist-v3.0.1` names that commit

#### Scenario: no release, no publish

- **WHEN** a push to `main` leaves release-please with only an open release pull request
- **THEN** the publish job does not run and `release` is unchanged

#### Scenario: manual publish

- **WHEN** the workflow is dispatched with `tag: v3.0.1` after a failed publish
- **THEN** the job produces the same `release` commit and the same `dist-v3.0.1` tag as the automatic run would have

#### Scenario: marketplace entry

- **WHEN** `claude plugin validate` runs on the repository root
- **THEN** it reports no error and the `bdk` entry names the `github` source with `ref: release`

#### Scenario: install from the distribution ref

- **WHEN** a clean project installs `bdk` from the marketplace after a release
- **THEN** the plugin directory contains `dist/bdk.mjs` and the eight adapters, and `hooks session-start` runs without the `kernel unavailable` message

### Requirement: Dependency matrix

A slice SHALL import another slice only through that slice's `index.ts` and only along a row of the matrix; the graph SHALL stay acyclic.

A slice imports another slice only through that slice's `index.ts`, and only along a row of this table. **Reads of committed state never need a slice import**: `shared/store` exposes typed queries over the index (open tickets of a Change, the `Files:` of a task, the manifests of a task, entry summaries, a ticket's active package, a group's package, the Change base that `review plan` and `evidence coverage` share) whose row shapes are T14's, so `evidence record` checks its ticket, `part done` checks for open tickets and `log add` checks its ticket without importing `attempt`. Behaviour several slices share without an edge between them lives in `shared/store` as well: the checkpoint (`change`, `attempt`, and `hooks` from T24) and the rebuild core (`service`, `change`). A slice import is for a use case or domain logic that another slice owns (the diff check owned by `part`, freshness owned by `evidence`, entry writing owned by `log`). This is what keeps the graph acyclic.

| From                                                                                       | May import                                                                  | Why                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| ------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `change`                                                                                   | `measure`, `graph`, `part`, `log`, `spec`                                   | `new` measures and asks the graph for the first artifact; `status` lists the plan parts as `part list` does; every verb writes entries; `close` merges specs.                                                                                                                                                                                                                                                                                                            |
| `graph`                                                                                    | `log`, `ctx`, `evidence`, `spec`                                            | `done` writes the entry; `next` composes the instruction from the kind template and the skill context; a post-task step node's state comes from `evidence`'s freshness of its latest covering manifest; the `spec-delta` and `plan-part` validators run `spec`'s delta check.                                                                                                                                                                                            |
| `part`                                                                                     | `graph`, `log`, `measure`                                                   | `start`, `done` and `split` run the `plan-part` and `execute-part` checks and write transition and decision entries; `done` of a `tiny` Change measures its commits (tiny guard).                                                                                                                                                                                                                                                                                        |
| `attempt`                                                                                  | `part`, `log`, `evidence`, `graph`                                          | `close` runs `part`'s diff check, `evidence`'s freshness check, records the `simplify` manifest through `evidence` and writes findings; `open` and `close` read the post-task step nodes and their order from `graph`.                                                                                                                                                                                                                                                   |
| `commit`                                                                                   | `part`, `log`, `measure`                                                    | The same diff check as `attempt close`, the finding for undeclared files, and the tiny guard.                                                                                                                                                                                                                                                                                                                                                                            |
| `dispatch`                                                                                 | `rules`, `log`, `export`, `graph`, `ctx`, `review`                          | The template hash covers the rule texts `rules` selects; a verifier's package lists the P8 categories `log` enforces; `adapter` comes from `export`'s role-to-adapter map; an artifact target's paths and a runner's steps come from `graph`; a runner's `Checks` come from the tool entries `ctx` owns. The role body is a plugin file read through `shared/store`. The integration reviewer's risks come from the `review.risks` module that `review` owns.            |
| `ctx`                                                                                      | `rules`, `log`                                                              | Rule text: `rules` owns the rule store and `languages` (`kernel-settings`), and `ctx` renders a skill's rule parts from it by id; the `verifier-policy` part renders the P8 lists `log` resolves and enforces (T42).                                                                                                                                                                                                                                                     |
| `rules`                                                                                    | `shared` only                                                               | Rule files are read from the bundle and `.bdk/rules/`; `stats`, `prune` and `accept` read the index, and `show --ticket` reads the package and stamps `rules-read`, all through `shared/store`.                                                                                                                                                                                                                                                                          |
| `hooks`                                                                                    | `change`, `graph`, `log`, `ctx`, `config`, `rules`, `agents`, `diagnostics` | `session-end` renders the verbose log through `diagnostics`; `session-start` composes status, startup context, the config check and the v2 layout detection of `config`, and the rules load of `rules`; `prompt-expansion` asks the graph and writes the transition; `session-end` checkpoints; the agent hooks, the lead and message guards and the continuation check read and write the registry of `agents`, and the continuation check asks `graph` for ready work. |
| `service`                                                                                  | every slice (read-only)                                                     | `doctor` and `rebuild` inspect all state (`doctor` takes the v2 layout detection from `config`); `rebuild` writes Change state through the `shared/store` rebuild core, not through a slice; its worktree recovery is `part`'s, since `part` owns the worktree and its setup (T45).                                                                                                                                                                                      |
| `review`                                                                                   | `measure`, `spec`                                                           | `plan` reads the module signals of `measure`; `render` reads the scenarios of the Change's spec deltas through the delta parser `spec` owns, to check the `## Intent` table (#158); `render` reads the same signals for its diagram; the plan parts, the `merge` reports, the entries, the evidence and the Change base come from `shared/store`.                                                                                                                        |
| `log`, `evidence`, `spec`, `config`, `query`, `measure`, `export`, `agents`, `diagnostics` | `shared` only                                                               | Leaves; `agents` reads ledger entries and task `Files:` for `--affected-by` through `shared/store`; `diagnostics` reads the journal, the registry and the ledger through `shared/store`.                                                                                                                                                                                                                                                                                 |

Edges not in the table are forbidden, including the reverse of every listed edge. The two structural tests below fail the build on a violation.

#### Scenario: import outside the matrix

- **WHEN** a file under `kernel/src/<slice>/` imports a slice that its matrix row does not list, imports a slice file other than its `index.ts`, or `shared/` imports a slice
- **THEN** the import scan fails the build

#### Scenario: checkpoint without a slice edge

- **WHEN** the import scan reads `kernel/src/attempt/`
- **THEN** it finds no import of `kernel/src/change/`, and the escalation checkpoint is reached through `shared/store`

#### Scenario: rules read without an attempt edge

- **WHEN** the import scan reads `kernel/src/rules/`
- **THEN** it finds no import of `kernel/src/attempt/`, and the `rules-read` stamp is written through `shared/store`

#### Scenario: evidence stays a leaf

- **WHEN** the import scan reads `kernel/src/evidence/`
- **THEN** it finds no import of another slice, and `graph`, `attempt` and no other slice import `evidence`

#### Scenario: rules is a leaf

- **WHEN** the import scan reads `kernel/src/rules/`
- **THEN** it finds no import of another slice

#### Scenario: agents is a leaf

- **WHEN** the import scan reads `kernel/src/agents/`
- **THEN** it finds no import of another slice, and only `hooks` and `service` import `agents`

#### Scenario: review imports only measure

- **WHEN** the import test reads `kernel/src/review/`
- **THEN** it imports no slice but `measure` and `spec`, `spec` through its `index.ts`, and no slice but `dispatch` imports `review`

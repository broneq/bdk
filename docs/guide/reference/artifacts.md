# Artifacts reference

!!! warning "Describes BDK v2"

    This page describes BDK v2. The v3 documentation replaces it (T50).

!!! note "BDK 3"

    [Settings and Changes](#settings-and-changes) describes BDK 3.

## Settings and Changes

BDK 3 keeps its state under `.bdk/` too, written only by the kernel (`bdk ...`) and the stage skills that call it:

| Path                       | Written by                                           | Tracked | Contents                                                                                                                                            |
| -------------------------- | ---------------------------------------------------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `.bdk/settings.yaml`       | `/bdk:setup` through `bdk config set`                | yes     | The project's languages, tool commands and feature flags, shared by the team                                                                        |
| `.bdk/settings.local.yaml` | `bdk config set --local`                             | no      | Your personal overrides                                                                                                                             |
| `.bdk/rules/`              | `bdk rules import`, `bdk rules accept`               | yes     | The project's rules, one file per rule id                                                                                                           |
| `.bdk/changes/<changeId>/` | `/bdk:change` through `bdk change new`, later stages | yes     | One Change: its intent, design, plan, ledger and progress                                                                                           |
| `.bdk/.machine/`           | the kernel                                           | no      | Caches, the schema copy, the branch bindings of the Changes and, under `worktrees/`, the worktrees of the parts in flight; rebuilt by `bdk rebuild` |
| `.bdk/.machine/review/`    | `bdk review render`                                  | no      | The human review report of a Change, `<changeId>.html` or `.md`                                                                                     |

The design stage writes into the Change directory:

| Path under `.bdk/changes/<changeId>/` | Written by                                | Contents                                                                                                  |
| ------------------------------------- | ----------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `design.md`                           | `/bdk:design`                             | The design of a `small` Change: `schema`, `title` and, for a product-only Change, `architecture: false`   |
| `design/parts/<nn>-<slug>.md`         | `/bdk:design`                             | The design of a `large` Change, one concern per part                                                      |
| `design/index.md`                     | `bdk done design-index`                   | Generated from the parts; never edited by hand                                                            |
| `architecture.md`                     | `/bdk:design`                             | The modules, boundaries and data flow the design touches                                                  |
| `log/`                                | `/bdk:design`, `/bdk:verify-design`       | `decision` and `question` entries of the design, the verifier's `report`, `blocker` and `finding` entries |
| `reports/`                            | the design verifier, through `log ingest` | The verifier's report, whose verdict the `design-verify` node reads                                       |

The plan stage writes into the same directory:

| Path under `.bdk/changes/<changeId>/` | Written by                              | Contents                                                                                                                                                                                              |
| ------------------------------------- | --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `plan/parts/<nn>-<slug>.md`           | `/bdk:plan`                             | One plan part: at most 8 tasks and 8 KB, each task a contract with its `Files:` and test cases; `isolation: worktree` builds it in its own worktree ([Worktree parts](../concepts/worktree-parts.md)) |
| `spec-delta/<capability>.md`          | `/bdk:plan`                             | The spec delta of each capability a part names in `spec-impact`, checked with `bdk spec delta check`                                                                                                  |
| `log/`                                | `/bdk:plan`, `/bdk:verify-plan`         | `decision` entries that settle open questions, the verifier's `report`, `blocker` and `finding` entries                                                                                               |
| `reports/`                            | the plan verifier, through `log ingest` | The verifier's report, whose verdict the `plan-verify` node reads                                                                                                                                     |

The execute stage writes into the same directory, and commits each task to the project:

| Path under `.bdk/changes/<changeId>/` | Written by                                 | Contents                                                                                     |
| ------------------------------------- | ------------------------------------------ | -------------------------------------------------------------------------------------------- |
| `attempts/`                           | `/bdk:execute` through `bdk attempt open`  | One ticket per dispatch round of a task, a part or its lead, with its outcome                |
| `dispatch/`                           | `bdk dispatch build`                       | The package each role agent reads as its whole prompt                                        |
| `reports/`                            | the role agents, through `log ingest`      | Each agent's report with its envelope                                                        |
| `evidence/`                           | `bdk evidence record`, `bdk attempt close` | The simplify, scoped test and lint results of each task, which the post-task step nodes read |
| `log/`                                | `/bdk:execute` and the role agents         | `finding`, `blocker`, `learning` and `decision` entries, and the stage's transitions         |

The review stage runs as rounds of one `review-fix` ticket each, and writes into the same directory:

| Path under `.bdk/changes/<changeId>/`             | Written by                                                              | Contents                                                                                         |
| ------------------------------------------------- | ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `dispatch/<target>-<role>-<ticket>-<group>.md`    | `bdk dispatch build --group`                                            | One package per reviewer group of the round, with the group's files, range and rules             |
| `reports/<target>-<role>-<ticket>-<group>.md`     | each reviewer, through `log ingest --ticket <ticket>@<group>`           | One report per group                                                                             |
| `reports/<target>-orchestrator-<ticket>-merge.md` | the orchestrator, through `log ingest --ticket <ticket>@merge`          | The merged review of the round, whose verdict the `review` node reads                            |
| `evidence/`                                       | the gate runner, through `bdk evidence record`, `bdk evidence coverage` | The `tests-full`, `lint-full` and `coverage` results of the whole Change                         |
| `log/`                                            | the reviewers and the orchestrator                                      | The round's `finding`, `blocker` and `observation` entries, each with its group and triage level |

`bdk review plan` gives the round its range and groups. The first round reviews from the Change's base, the parent of the commit that added `change.md`. A later round reviews only what was committed since the previous merged review, whose `report` entry records the reviewed commit as `head`. `--full` reviews from the Change's base again; `--base <ref>` reviews from the merge base with `<ref>`, for a branch stacked on another one. The groups are the plan parts that the range touches, then `unplanned` for files no task names, then `integration` over every changed file. A Change without a plan is grouped by module. A group above `review.group.max-files` (default 30) is split by module.

Before its verdict, the round runs the full gate: `tests-full` runs every `tools.test` command and `lint-full` every `tools.lint` command, both against the whole Change. A `tools.test` entry with a `coverage` object (`command`, `report`, `format: lcov|cobertura`, `min`) also needs `bdk evidence coverage`. The kernel reads the report and counts only the lines the Change added in executable files. It decides `pass` or `fail` against `min` itself. Files the report does not list go to `unmeasured`. A fix after the gate makes both nodes stale.

The orchestrator triages every entry of the round, and every other live entry of the Change without a level, with `bdk log triage <id> blocker|should-fix|nice-to-have|not-a-problem`; `not-a-problem` needs `--reason` and resolves the entry. `review` passes only on the round's merged report, with every entry of the round triaged and no live entry triaged `blocker`. An `ok` close ends its round: the next `review-fix` ticket starts at attempt 1 with the full budget, and its record names the round it follows as `after`.

The integration reviewer also gets the project's risky areas from `review.risks`, a list of `{id, instruction, paths, enabled}` merged by `id` over six defaults (`auth`, `migration`, `secrets`, `public-api`, `dependencies`, `configuration`). `paths` are globs: the report opens a card for a risk whose paths match a changed file, and for any risk the integration reviewer summarises under `## Areas` in its report. Set `enabled: false` on an item to turn it off.

After the review, the human decides each open entry with `bdk log decide <id> fix|defer|reject|track`, through the report of `/bdk:cr`:

| Disposition | Effect on the entry                                                                                    |
| ----------- | ------------------------------------------------------------------------------------------------------ |
| `fix`       | Its level becomes `blocker`, so the next round fixes it first                                          |
| `defer`     | It stays open, accepted; the PR summary lists it as deferred                                           |
| `reject`    | It is resolved; `--reason` is required                                                                 |
| `track`     | It stays open, accepted, with `--issue <url or key>`; the PR summary lists it as tracked in that issue |

`--review` marks a `defer` or `track` made without the user, as `/bdk:run` does, to be reviewed. `bdk change close` refuses with `policy/undecided-entries` while a live `finding`, `observation` or `blocker` has no disposition, or a `fix` is not made. The `tracker` setting says where `track` files an issue: `{kind: github}` for GitHub issues through `gh`, or `{kind: instruction, instruction: "<how to file one>"}` for any other tracker. While it is unset, the report offers no `track`.

`bdk config set` adds `/.bdk/.machine/` and `/.bdk/settings.local.yaml` to `.gitignore`. The v2 file `.bdk/settings.json` is never read; `/bdk:setup` migrates a project that still has it.

Everything BDK skills write to disk lives under `.bdk/` in the project root, per `.claude/rules/artifacts.md`:

```
Skill artifacts → .bdk/<skill-name>/<output-file>
```

This page lists every directory under `.bdk/` that appears in BDK's own sources, which skill writes to it, and whether any of it is tracked by git.

## Layout

| Path                         | Written by                                                          | Contents                                                                                             |
| ---------------------------- | ------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `.bdk/settings.json`         | BDK 2 setup                                                         | v2 project configuration; `/bdk:setup` migrates it to `.bdk/settings.yaml`                           |
| `.bdk/plans/`                | BDK 2 `/bdk:create-plan`                                            | v2 implementation plans; BDK 3 plans live in the Change, and `/bdk:setup` deletes this directory     |
| `.bdk/design/`               | BDK 2 `/bdk:design`                                                 | v2 design docs; BDK 3 designs live in the Change, and `/bdk:setup` deletes this directory            |
| `.bdk/verify-plan/`          | BDK 2 `/bdk:verify-plan`                                            | v2 verification reports; `/bdk:setup` deletes this directory                                         |
| `.bdk/runs/`                 | BDK 2 `/bdk:subagent-execute-plan` (via `scripts/bdk_run_state.py`) | Run manifests, `.bdk/runs/<run-id>.json` - machine state, never hand-edited; BDK 3 removed the skill |
| `.bdk/cr/`                   | `/bdk:cr`                                                           | Code review reports, `.bdk/cr/{stamp}-{branch-slug}-{delta\|full}.md`                                |
| `.bdk/explain-complex-code/` | `/bdk:explain-complex-code`                                         | Architecture docs, `.bdk/explain-complex-code/[feature-name].md`                                     |

## Run state: the one directory no skill reads or writes directly

`.bdk/runs/<run-id>.json` is **cross-skill run state**, not any single skill's artifact: the BDK 2 `/bdk:subagent-execute-plan` advanced it and `/bdk:cr` reads it. Only `scripts/bdk_run_state.py` reads or writes the file. Per its own docstring:

```
This script is the ONLY reader and writer of the manifest. Do not hand-edit
the JSON - an edit that git does not agree with is discarded on next read.
Use `print` for a human-readable view.
```

Git commit trailers (`BDK-Run:`, `BDK-Group:`) are the durable ground truth behind the manifest; the manifest is a cache that makes resume cheap. When the two disagree, git wins and the script corrects the manifest in place (a `reconcile` step run on every read). See [The plan pipeline](../concepts/plan-pipeline.md).

## What gets tracked

Nothing in the v2 layout above. Every path in its table is local to your clone - `.bdk/settings.json` included.

`scripts/bdk_run_state.py` enforces this: on every run-manifest write it probes `git check-ignore` for the manifest path, and when no existing rule already covers it (wherever that rule lives, including `.git/info/exclude`) it appends this block to the project's `.gitignore`:

```
# BDK run state - machine-owned, never committed
/.bdk/
```

That happens the first time a plan is executed in a project that had no equivalent rule, and it happens once: the script scans the existing `.gitignore` first and never appends a duplicate. `/.bdk/` covers the whole directory, so settings, plans, designs, verification reports, review reports, architecture docs and run state are all ignored by the same line.

In BDK 3, `.bdk/settings.yaml` is tracked so the team shares the commands; see [Settings and Changes](#settings-and-changes) and [Setup](../getting-started/setup.md).

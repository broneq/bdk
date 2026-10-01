# Artifacts reference

!!! warning "Describes BDK v2"

    This page describes BDK v2. The v3 documentation replaces it (T50).

!!! note "BDK 3"

    [Settings and Changes](#settings-and-changes) describes BDK 3.

## Settings and Changes

BDK 3 keeps its state under `.bdk/` too, written only by the kernel (`bdk ...`) and the stage skills that call it:

| Path                       | Written by                                           | Tracked | Contents                                                                                 |
| -------------------------- | ---------------------------------------------------- | ------- | ---------------------------------------------------------------------------------------- |
| `.bdk/settings.yaml`       | `/bdk:setup` through `bdk config set`                | yes     | The project's languages, tool commands and feature flags, shared by the team             |
| `.bdk/settings.local.yaml` | `bdk config set --local`                             | no      | Your personal overrides                                                                  |
| `.bdk/rules/`              | `bdk rules import`, `bdk rules accept`               | yes     | The project's rules, one file per rule id                                                |
| `.bdk/changes/<changeId>/` | `/bdk:change` through `bdk change new`, later stages | yes     | One Change: its intent, design, plan, ledger and progress                                |
| `.bdk/.machine/`           | the kernel                                           | no      | Caches, the schema copy and the branch bindings of the Changes; rebuilt by `bdk rebuild` |

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

| Path under `.bdk/changes/<changeId>/` | Written by                              | Contents                                                                                                |
| ------------------------------------- | --------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `plan/parts/<nn>-<slug>.md`           | `/bdk:plan`                             | One plan part: at most 8 tasks and 8 KB, each task a contract with its `Files:` and test cases          |
| `spec-delta/<capability>.md`          | `/bdk:plan`                             | The spec delta of each capability a part names in `spec-impact`, checked with `bdk spec delta check`    |
| `log/`                                | `/bdk:plan`, `/bdk:verify-plan`         | `decision` entries that settle open questions, the verifier's `report`, `blocker` and `finding` entries |
| `reports/`                            | the plan verifier, through `log ingest` | The verifier's report, whose verdict the `plan-verify` node reads                                       |

`bdk config set` adds `/.bdk/.machine/` and `/.bdk/settings.local.yaml` to `.gitignore`. The v2 file `.bdk/settings.json` is never read; `/bdk:setup` migrates a project that still has it.

Everything BDK skills write to disk lives under `.bdk/` in the project root, per `.claude/rules/artifacts.md`:

```
Skill artifacts → .bdk/<skill-name>/<output-file>
```

This page lists every directory under `.bdk/` that appears in BDK's own sources, which skill writes to it, and whether any of it is tracked by git.

## Layout

| Path                         | Written by                                                    | Contents                                                                                         |
| ---------------------------- | ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `.bdk/settings.json`         | BDK 2 setup                                                   | v2 project configuration; `/bdk:setup` migrates it to `.bdk/settings.yaml`                       |
| `.bdk/plans/`                | BDK 2 `/bdk:create-plan`                                      | v2 implementation plans; BDK 3 plans live in the Change, and `/bdk:setup` deletes this directory |
| `.bdk/design/`               | BDK 2 `/bdk:design`                                           | v2 design docs; BDK 3 designs live in the Change, and `/bdk:setup` deletes this directory        |
| `.bdk/verify-plan/`          | BDK 2 `/bdk:verify-plan`                                      | v2 verification reports; `/bdk:setup` deletes this directory                                     |
| `.bdk/runs/`                 | `/bdk:subagent-execute-plan` (via `scripts/bdk_run_state.py`) | Run manifests, `.bdk/runs/<run-id>.json` - machine state, never hand-edited                      |
| `.bdk/cr/`                   | `/bdk:cr`                                                     | Code review reports, `.bdk/cr/{stamp}-{branch-slug}-{delta\|full}.md`                            |
| `.bdk/explain-complex-code/` | `/bdk:explain-complex-code`                                   | Architecture docs, `.bdk/explain-complex-code/[feature-name].md`                                 |

## Run state: the one directory no skill reads or writes directly

`.bdk/runs/<run-id>.json` is **cross-skill run state**, not any single skill's artifact: `/bdk:subagent-execute-plan` advances it and `/bdk:cr` reads it. Only `scripts/bdk_run_state.py` reads or writes the file. Per its own docstring:

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

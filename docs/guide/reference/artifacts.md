# Artifacts reference

!!! warning "Describes BDK v2"

    This page describes BDK v2. The v3 documentation replaces it (T50).

Everything BDK skills write to disk lives under `.bdk/` in the project root, per `.claude/rules/artifacts.md`:

```
Skill artifacts → .bdk/<skill-name>/<output-file>
```

This page lists every directory under `.bdk/` that appears in BDK's own sources, which skill writes to it, and whether any of it is tracked by git.

## Layout

| Path | Written by | Contents |
|---|---|---|
| `.bdk/settings.json` | `/bdk:setup` | Project configuration - see the [README](https://github.com/broneq/bdk/blob/main/README.md#settings) |
| `.bdk/plans/` | `/bdk:create-plan` | Implementation plans (`mkdir -p .bdk/plans` runs from the skill's `UserPromptSubmit` hook) |
| `.bdk/design/` | `/bdk:design` | Design docs, `.bdk/design/YYYY-MM-DD-HHMM-<slug>-design.md` |
| `.bdk/verify-plan/` | `/bdk:verify-plan` | Verification reports, `.bdk/verify-plan/<plan-slug>-verification.md` |
| `.bdk/runs/` | `/bdk:subagent-execute-plan` (via `scripts/bdk_run_state.py`) | Run manifests, `.bdk/runs/<run-id>.json` - machine state, never hand-edited |
| `.bdk/cr/` | `/bdk:cr` | Code review reports, `.bdk/cr/{stamp}-{branch-slug}-{delta\|full}.md` |
| `.bdk/explain-complex-code/` | `/bdk:explain-complex-code` | Architecture docs, `.bdk/explain-complex-code/[feature-name].md` |
| `.bdk/tmp/.rules_drift/` | `hooks/check-rules-drift/check.py` | Per-session drift-detection cursor, `.bdk/tmp/.rules_drift/drift-<session_id>.json` (content fingerprints, not human-readable) |

## Run state: the one directory no skill reads or writes directly

`.bdk/runs/<run-id>.json` is **cross-skill run state**, not any single skill's artifact: `/bdk:subagent-execute-plan` advances it and `/bdk:cr` reads it. Only `scripts/bdk_run_state.py` reads or writes the file. Per its own docstring:

```
This script is the ONLY reader and writer of the manifest. Do not hand-edit
the JSON - an edit that git does not agree with is discarded on next read.
Use `print` for a human-readable view.
```

Git commit trailers (`BDK-Run:`, `BDK-Group:`) are the durable ground truth behind the manifest; the manifest is a cache that makes resume cheap. When the two disagree, git wins and the script corrects the manifest in place (a `reconcile` step run on every read). See [The plan pipeline](../concepts/plan-pipeline.md).

## What gets tracked

Nothing. Every path in the table above is local to your clone - `.bdk/settings.json` included.

`scripts/bdk_run_state.py` enforces this: on every run-manifest write it probes `git check-ignore` for the manifest path, and when no existing rule already covers it (wherever that rule lives, including `.git/info/exclude`) it appends this block to the project's `.gitignore`:

```
# BDK run state - machine-owned, never committed
/.bdk/
```

That happens the first time a plan is executed in a project that had no equivalent rule, and it happens once: the script scans the existing `.gitignore` first and never appends a duplicate. `/.bdk/` covers the whole directory, so settings, plans, designs, verification reports, review reports, architecture docs and run state are all ignored by the same line.

Because `.bdk/settings.json` is not shared through git, every contributor runs `/bdk:setup` once after cloning. Setup derives its commands by probing the project's own files, so two contributors on the same repo get the same settings without a tracked file (see `/bdk:setup` Phase 6 and [Setup](../getting-started/setup.md)).

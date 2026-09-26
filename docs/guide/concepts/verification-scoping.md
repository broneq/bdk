# Verification scoping

!!! warning "Describes BDK v2"

    This page describes BDK v2. The v3 documentation replaces it (T50).

Running the whole test suite after every edit feels safe and is the main reason agent-driven development is slow. BDK's position is that verification should be proportional to what changed, and that the decision must be mechanical rather than a judgement call made fresh each time.

## Proportionality

This table is in the shared foundation, so it applies in every session, including ones where you never invoke a BDK skill:

| Changed files                                                                     | Verification                                                                       |
| --------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Non-executable content only (yaml, md, json, config not feeding build or codegen) | No tests, no typecheck. At most a syntax or schema validator if one is configured. |
| Source files                                                                      | Scoped or related tests, scoped lint, incremental typecheck.                       |
| Build-feeding config (tsconfig, lockfile, codegen schema)                         | Treat as source.                                                                   |
| Full suite                                                                        | Only when explicitly asked, or at a pipeline's end-of-plan gate.                   |

The third row is the one that is easy to get wrong. A lockfile or a codegen schema is not executable, but changing it can break compilation without a single source file being touched, so it counts as source.

The rule that follows from the table is short: never widen a verification run "just to be safe".

## The `Verification: none` task class

A plan task may declare `Verification: none` when **all** of its `Files:` fall into one of three buckets:

- non-executable content (yaml, md, json, plain config not consumed by build or codegen),
- pure wiring or glue,
- a refactor already fully covered by existing tests.

Such a task carries no `Test cases:` block, never enters `/bdk:test-driven-development`, and is verified by its own `Success criterion` plus the end-of-plan review. The executor reads the declaration at Step 0 and skips the red-green cycle for that task.

This exists because forcing a test onto a documentation task produces a test that asserts the file exists, which is a maintenance cost with no signal. Declaring the exemption in the plan makes it visible and reviewable instead of leaving the implementer to improvise.

!!! warning
`Verification: none` is a claim about every file in the task. One source file in the `Files:` list disqualifies it.

## Tiers and command forms

Scoped verification only works if BDK knows which of your commands is the cheap one and how to narrow it. That is what the `test-tools` and `lint-tools` entries in `.bdk/settings.json` encode. Each entry declares a `tier` and the narrower forms of the same command:

| Field         | What it is for                                                                                              |
| ------------- | ----------------------------------------------------------------------------------------------------------- |
| `tier`        | `fast` or `e2e` for tests; `lint`, `format`, or `typecheck` for lint. Decides **when** the command may run. |
| `command`     | The full unscoped form. The slowest one, reserved for the end-of-plan gate.                                 |
| `scoped`      | Narrowed to an explicit path list. Contains `{files}`.                                                      |
| `related`     | The tests _covering_ given source files, for runners that compute that themselves. Contains `{files}`.      |
| `failed`      | Re-runs only what failed, so a fix attempt does not pay for a suite.                                        |
| `incremental` | Cache-reusing form of a check that cannot take a path list, typecheckers above all.                         |

Omit any form your tool does not have; BDK falls back cleanly from a missing one. `tier` is technically optional and should always be set anyway: BDK infers a missing tier from the tool name, and an inferred `fast` on an end-to-end runner means a slow suite runs at every group boundary. The v3 settings are described in the [README](https://github.com/broneq/bdk/blob/main/README.md#settings).

`related` deserves a note of its own. It replaces asking an exploration subagent which tests cover a change, which is a round trip on the critical path of every group to answer a question the runner answers in a second.

## How the executor spends them

During a plan run, the cadence follows directly from the forms above:

- **Per task**: the task's own test file only.
- **Per group**: the tests covering the group's changed files, fast tier only. An end-to-end tier runs mid-plan only for specs the group itself added or modified, or as a deliberate widening when the group changed a public contract.
- **Per fix cycle**: the failures, or the files the fixer touched. A re-engagement after a fix is always narrower than the run before it, never wider.
- **Lint and format**: the changed file list. **Typecheck**: the incremental form, so the cache survives between groups.
- **Once per plan**: the full unscoped suite of every tier, at the end-of-plan gate.

Verification agents are given paths and intent, never a resolved command string. They resolve the form themselves from settings, which is what keeps scoping correct when settings change.

## Where the tiers come from

You do not write these entries by hand. `/bdk:setup` probes the project, finds the runners and checkers it recognises, and derives a tier and the narrower forms for each. You review what it wrote and correct it. See [Setup](../getting-started/setup.md).

The one thing worth checking by hand is the tier on any end-to-end runner, because that is the field with an expensive failure mode: an end-to-end suite mislabelled `fast` runs at every group boundary of a long plan, and nothing about that looks wrong from the outside except the wall clock.

## Anti-patterns

- **Running the full suite after a documentation change.** The proportionality table's first row exists precisely for this.
- **Widening a re-run after a fix.** A verification pass that follows a fix is narrower than the one before it. If it is wider, something is being re-checked for reassurance rather than for information.
- **Passing a resolved command string to a verification agent.** Pass paths and intent; let the agent resolve the form from settings, so the scoping stays right when settings change.
- **Spending an exploration dispatch to find which tests cover a change** when the fast tier declares a `related` form. The runner answers that in a second.
- **Running an end-to-end tier per group as a precaution.** Net slower than one late failure, with two exceptions: specs the group itself touched, and a deliberate widening when the group changed a public contract.

## Keeping the definitions in sync

The `Verification: none` definition and the source versus non-executable partition are repeated in several places: the planning and execution skills, the internal tool meta-skills, and the shared foundation. No test enforces their consistency. If one copy drifts, verification is silently skipped or silently over-run, so all copies are edited together.

Next: [The plan pipeline](plan-pipeline.md) for where the end-of-plan gate sits.

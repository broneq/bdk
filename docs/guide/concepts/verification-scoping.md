# Verification scoping

Running the whole test suite after every edit feels safe and is the main reason
agent-driven development is slow. BDK checks each task against the files it
changed, runs the whole suite once per Change, and decides mechanically, in the
kernel, which evidence is still valid. No agent decides "to be safe" to run more.

## Proportionality

The shared foundation carries this table into every session, so it applies even
where you never invoke a BDK skill:

| Changed files                                                                     | Verification                                                                       |
| --------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Non-executable content only (yaml, md, json, config not feeding build or codegen) | No tests, no typecheck. At most a syntax or schema validator if one is configured. |
| Source files                                                                      | Scoped or related tests, scoped lint, incremental typecheck.                       |
| Build-feeding config (tsconfig, lockfile, codegen schema)                         | Treat as source.                                                                   |
| Full suite                                                                        | Only when explicitly asked, or at a pipeline's end-of-plan gate.                   |

The third row is the one that is easy to get wrong. A lockfile is not
executable, but changing it can break the build without a single source file
being touched, so it counts as source.

## The file partition

Inside a Change the table is not advice: two glob lists of the settings decide
it for the kernel.

| Key                              | Files                                                                                       | Effect                                                         |
| -------------------------------- | ------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| `policy.evidence.non-executable` | Markdown, text and images, `docs/**`, `LICENSE*`, `CHANGELOG*`, `.bdk/**` by default        | Never part of a check's scope                                  |
| `policy.evidence.build-config`   | Manifests and lockfiles (`package.json`, `pnpm-lock.yaml`, `pyproject.toml`, `go.mod`, ...) | Always part of every check's scope; wins over `non-executable` |

Every other file a task names is source. Both lists only grow across the
[configuration layers](../reference/configuration.md#evidence): a project adds
its own globs and never removes a default. A project whose Markdown is
executable, such as a documentation site whose build fails on a dead link,
lists those paths in `build-config`.

## The tree hash

Each piece of evidence records the **tree hash** of its target: a hash over the
source files of the target's tasks plus every build-config file in the working
tree. The target is a task (its part's files), a part, or the whole Change.

Evidence is fresh exactly while that hash is unchanged. Editing a source file
of the part makes its test evidence stale, and the post-task step has to run
again; editing a README does not, because non-executable files are not in the
hash; touching a lockfile anywhere makes every piece of evidence stale.

```sh
bdk evidence check 02-3      # fresh, or the files changed since
```

`bdk attempt close` refuses evidence whose tree hash differs from the working
tree, so a task cannot close on a test run from before its last edit.

## What runs when

| When                       | What runs                                                                                                                                                                                |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| After each task            | `tests-scoped`: every `fast` test entry in its `related` form, else `scoped`, else `command`, on the task's source files. `lint`: every lint entry in its `scoped` form, else `command`. |
| A task with no source file | Both steps record `not-run`, which the close accepts up to `policy.budgets.not-run` times per part.                                                                                      |
| Before the review verdict  | `tests-full` and `lint-full`: every test and lint entry's full `command`, e2e included, once against the whole Change, plus coverage when an entry has a `coverage` object.              |
| A fix after the full gate  | Makes `tests-full` and `lint-full` stale, so they run again before the verdict.                                                                                                          |

The kernel writes the commands into the runner's dispatch package with
`{files}` already filled, so the runner runs exactly what the package says and
never widens it. An `e2e` test entry never runs per task.

A form you leave out falls back to the full command, which is correct but slow;
a wrong form runs the wrong thing. `/bdk:setup` derives the forms from the
runner and leaves out the ones a tool does not support. See
[Tool entries](../reference/configuration.md#tool-entries).

## Verification: none

A plan task may declare `**Verification:** none` instead of
`**Test cases:**` when every file in its `Files:` is non-executable content,
pure wiring, or a refactor already fully covered by existing tests. Such a task
is not run test-first and is verified by its part's success measure and by the
review.

This exists because forcing a test onto a documentation task produces a test
that asserts the file exists, which costs maintenance and catches nothing.
Declaring the exemption in the plan makes it visible to the plan verifier and
the reviewer instead of leaving the implementer to improvise. One source file
in `Files:` disqualifies it.

## Anti-patterns

- **Running the full suite after a documentation change.** The first row of the
  table exists for exactly this.
- **Marking an end-to-end runner `fast`.** It then runs after every task of a
  long plan, and nothing looks wrong except the wall clock. Check the tier of
  every e2e entry `/bdk:setup` wrote.
- **Adding a test to a non-executable task to satisfy the grammar.** Declare
  `Verification: none` instead.
- **Leaving generated or executable docs in `non-executable`.** A change to them
  would never invalidate evidence; list them in `build-config`.

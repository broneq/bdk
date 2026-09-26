# Project setup

!!! warning "Describes BDK v2"

    This page describes BDK v2. The v3 documentation replaces it (T50).

`/bdk:setup` runs once per project. It probes your project files, confirms what
it found with you, and writes `.bdk/settings.json` - the file every BDK skill
and agent reads to learn how to test, lint, and build this codebase.

Type it yourself; the skill is user-invocable only, so Claude will not start it
on its own.

```
/bdk:setup
```

Pass `--force` to re-run it over existing settings.

## What the phases do

| Phase                              | What happens                                                                                                                                                                                                                                                                                                                                                     |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Check existing config           | If `.bdk/settings.json` exists and `--force` was not passed, it shows the current values and asks whether to overwrite.                                                                                                                                                                                                                                          |
| 2. Probe project files             | Reads `package.json`, `pyproject.toml`, `go.mod`, `Cargo.toml`, `pom.xml`, `composer.json`, `Gemfile`, `*.csproj`, `pubspec.yaml` and friends, and extracts test, lint, and build commands. Package-manager invocation always wins over a bare binary: a lockfile decides `npm`/`yarn`/`pnpm`, `poetry.lock` decides `poetry run`, Ruby is always `bundle exec`. |
| 2b. Fill in tier and scoping forms | Derives the narrow command forms from the detected runner (table below).                                                                                                                                                                                                                                                                                         |
| 3. Confirm via AskUserQuestion     | Up to four questions in one call: test commands, lint commands, features to **disable**, and a build command when one was detected. Only the full commands are confirmed; tiers and scoped forms are mechanical consequences of the runner and are shown in the completion summary instead.                                                                      |
| 4. Write `.bdk/settings.json`      | Writes the confirmed values plus the derived forms, and creates the directory tree.                                                                                                                                                                                                                                                                              |
| 5. Git guidance                    | Confirms that `.bdk/` stays out of git and offers to write the rule.                                                                                                                                                                                                                                                                                             |

### Why tiers matter

BDK runs scoped checks throughout a plan and the full suite exactly once, at the
end. That only works if each tool entry says which class of check it is and how
to narrow it. Every `test-tools` entry gets a `tier` of `fast` or `e2e`; every
`lint-tools` entry gets `lint`, `format`, or `typecheck`. Leave the tier out and
BDK infers it from the tool name, and an inferred `fast` on an end-to-end runner
means a slow suite runs at every group boundary.

`{files}` is a literal placeholder; callers substitute a path list.

| Runner     | `scoped`                         | `related`                             | `failed`                            | `incremental`              |
| ---------- | -------------------------------- | ------------------------------------- | ----------------------------------- | -------------------------- |
| vitest     | `npx vitest run {files}`         | `npx vitest related --run {files}`    | `npx vitest run --changed`          | -                          |
| jest       | `npx jest {files}`               | `npx jest --findRelatedTests {files}` | `npx jest --onlyFailures`           | -                          |
| playwright | `npx playwright test {files}`    | -                                     | `npx playwright test --last-failed` | -                          |
| cypress    | `npx cypress run --spec {files}` | -                                     | -                                   | -                          |
| pytest     | `pytest {files}`                 | -                                     | `pytest --lf`                       | -                          |
| go test    | `go test {files}`                | -                                     | -                                   | -                          |
| cargo test | `cargo test {files}`             | -                                     | -                                   | -                          |
| rspec      | `bundle exec rspec {files}`      | -                                     | `bundle exec rspec --only-failures` | -                          |
| eslint     | `npx eslint {files}`             | -                                     | -                                   | -                          |
| prettier   | `npx prettier --check {files}`   | -                                     | -                                   | -                          |
| ruff       | `ruff check {files}`             | -                                     | -                                   | -                          |
| tsc        | -                                | -                                     | -                                   | `npx tsc -b --incremental` |
| mypy       | `mypy {files}`                   | -                                     | -                                   | `mypy --incremental .`     |

For anything not in the table: a package-manager script wrapping a runner that
takes paths becomes `<script> -- {files}` (the `--` is required or the paths
reach the package manager, not the runner). A tool that takes no path list gets
no `scoped` form. If you are not sure a form exists, omit it - BDK falls back
cleanly from a missing form and silently runs the wrong thing with a broken one.

!!! warning
`scoped` and `related` must contain `{files}`. The config hook rejects
settings where they do not, because such a command ignores the file list and
quietly runs everything.

## The two feature flags

| Flag      | What it toggles                                                                                                                                                                                                              |
| --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `caveman` | Caveman communication mode.                                                                                                                                                                                                  |
| `lavish`  | Routes bundled multi-question decision points through the `lavish-axi` binary instead of the terminal `AskUserQuestion`. Also requires the binary on `PATH`; skills check both and fall back silently when either is absent. |

Phase 3 asks whether to **disable** `caveman` - an empty selection leaves it
enabled. `lavish` is not offered there; add it to `features` by hand if
you want it.

## What gets written

```
.bdk/
├── settings.json
├── plans/
└── design/
```

Other directories appear as skills produce artifacts: `.bdk/verify-plan/`,
`.bdk/cr/`, `.bdk/runs/`, and so on. The full map is in
[Artifacts](../reference/artifacts.md).

## What gets tracked

Nothing under `.bdk/` is tracked - settings, plans, designs, reports and run
state alike.

`scripts/bdk_run_state.py` appends `/.bdk/` to `.gitignore` on the first plan
run, so the rule covers all of them at once. The script guarantees on every
write that a run manifest is not committable: it probes `git check-ignore`
first, leaves any existing rule alone wherever it lives (including
`.git/info/exclude`), and only when nothing covers the path appends to the
project `.gitignore`:

```
# BDK run state - machine-owned, never committed
/.bdk/
```

Phase 6 offers to write the same rule for you earlier, so `.bdk/` is ignored
from your first commit rather than from your first plan run.

Each contributor runs `/bdk:setup` once after cloning. Because setup probes the
project's own files, everyone derives the same commands - team consistency
without a tracked file.

## Restart the session

Setup finishes by printing:

```
[setup] .bdk/settings.json created.
[setup] Test tiers: {tier}={command} (scoped: {scoped|none}) …
[setup] Lint tiers: {tier}={command} (scoped: {scoped|none}) …
[setup] Directories created: .bdk/plans/, .bdk/design/
[setup] Restart your Claude Code session — BDK will inject project settings on startup.
```

Read the tier lines before you restart. They exist so a wrong derivation is
caught now, by the one person who knows the project, rather than showing up
later as a slow suite running at every group boundary. If a line is wrong, edit
`.bdk/settings.json` or re-run `/bdk:setup --force`.

The restart matters: the settings summary is injected by a `SessionStart` hook,
so the session you ran setup in does not have it yet.

## What you get

- The project settings, checked by `bdk config check` on every session start.
- `.bdk/plans/` and `.bdk/design/`, ready for the first artifacts.
- Sessions that no longer block, and that start with your project's languages,
  commands, and feature flags in context.

## Next step

[Run your first feature through the full pipeline](first-feature.md).

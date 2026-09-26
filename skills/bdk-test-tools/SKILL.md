---
name: bdk-test-tools
description: Project-configured test commands (`tools.test` of the BDK settings). Preloaded into agents that run tests; not user-facing.
allowed-tools: Bash(node "${CLAUDE_PLUGIN_ROOT}/dist/bdk.mjs" *) Bash(echo *)
user-invocable: false
---

Test command(s) for this project, as the YAML list `tools.test`, one entry per command:

!`node "${CLAUDE_PLUGIN_ROOT}/dist/bdk.mjs" config show tools.test 2>&1 || echo "BDK STOP: bdk config show failed (exit $?). Install Node >= 22.13, then run bdk config check."`

If the list above is empty (`[]`), no test command is configured: emit one warning line `[bdk] no tools.test entry in .bdk/settings.yaml - run /bdk:setup`, then detect from project files (`package.json` scripts, `Makefile`, `pyproject.toml`, `go.mod`, `Cargo.toml`, etc.) and proceed under the same policy below. If it shows an error or a `BDK STOP` line instead, repeat that line to the user and detect the same way.

## Pick the form, not just the command

Each entry has an `id`, a `tier` and up to four forms of the same command: `command` (the full, unscoped run) plus the optional `scoped`, `related` and `failed`. `{files}` is a placeholder: replace it with the space-separated paths you were given, quoted. When an entry has `when`, follow it: it says when that command is the right one.

| Form      | Run it when                                                                                                                                                               |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `scoped`  | **Default.** You were given file paths, or you know which test files matter.                                                                                              |
| `related` | You were given _source_ paths and need the tests covering them. Use this instead of asking another agent which tests cover a change — the runner computes it in a second. |
| `failed`  | Re-running after a fix, when the previous run in this session already failed.                                                                                             |
| `command` | Only when the caller explicitly asked for a full suite.                                                                                                                   |

If an entry has no `scoped` form, derive one from `command` by appending the paths the runner accepts (`<command> -- {files}` for an npm/yarn/pnpm script, a bare path list for most direct runners). Say in your report that you derived it, so the settings can be fixed once instead of re-derived forever.

## Tier policy

- If **every** path you were given is non-executable content (yaml/md/json/plain config not feeding build or codegen), do not run any tier at all - report `nothing to verify for these paths: <list>` instead. Build-feeding config (tsconfig, lockfiles, codegen schemas) counts as source.
- A `fast` tier is cheap: run it scoped whenever you have paths.
- An `e2e` tier is the most expensive thing in the pipeline. Run it **only** when either the caller passed you e2e spec paths (because the work touched those specs), or the caller explicitly asked for the end-of-run full gate. Never reach for an e2e tier on your own initiative because a change "might" affect a flow.
- **The unscoped `command` form of any tier runs once per plan, at the end-of-plan gate.** Everywhere else — per task, per group, per fix cycle — is scoped, related, or failed. If you cannot scope a tier you were asked to run and the caller did not ask for a full run, report that rather than silently running everything.

## Reporting

Always name the exact command you ran (form and substituted paths) alongside the pass/fail counts. A caller deciding whether a later result still stands needs to know what was actually covered, and "tests passed" without a scope is not an answer.

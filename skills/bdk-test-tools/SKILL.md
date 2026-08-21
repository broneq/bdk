---
name: bdk-test-tools
description: Project-configured test commands from .bdk/settings.json. Preloaded into agents that run tests; not user-facing.
allowed-tools: Bash(python3 ${CLAUDE_PLUGIN_ROOT}/scripts/*)
user-invocable: false
---

Test command(s) for this project, one block per tier:

!`python3 ${CLAUDE_PLUGIN_ROOT}/scripts/get_settings.py test-tools`

If the line above reads `run the project's test suite`, `.bdk/settings.json` is not configured — emit one warning line `[bdk] .bdk/settings.json not configured — run /bdk:setup` then detect from project files (`package.json` scripts, `Makefile`, `pyproject.toml`, `go.mod`, `Cargo.toml`, etc.) and proceed under the same policy below.

## Pick the form, not just the command

Each block names a tier and up to four forms of the same command. `{files}` is a placeholder: replace it with the space-separated paths you were given, quoted.

| Form | Run it when |
|---|---|
| `scoped` | **Default.** You were given file paths, or you know which test files matter. |
| `related` | You were given *source* paths and need the tests covering them. Use this instead of asking another agent which tests cover a change — the runner computes it in a second. |
| `failed` | Re-running after a fix, when the previous run in this session already failed. |
| `full` | Only when the caller explicitly asked for a full suite. |

If a block has no `scoped` form, derive one from `full` by appending the paths the runner accepts (`<full> -- {files}` for an npm/yarn/pnpm script, a bare path list for most direct runners). Say in your report that you derived it, so the settings can be fixed once instead of re-derived forever.

## Tier policy

- If **every** path you were given is non-executable content (yaml/md/json/plain config not feeding build or codegen), do not run any tier at all - report `nothing to verify for these paths: <list>` instead. Build-feeding config (tsconfig, lockfiles, codegen schemas) counts as source.
- A `fast` tier is cheap: run it scoped whenever you have paths.
- An `e2e` tier is the most expensive thing in the pipeline. Run it **only** when either the caller passed you e2e spec paths (because the work touched those specs), or the caller explicitly asked for the end-of-run full gate. Never reach for an e2e tier on your own initiative because a change "might" affect a flow.
- **The unscoped `full` form of any tier runs once per plan, at the end-of-plan gate.** Everywhere else — per task, per group, per fix cycle — is scoped, related, or failed. If you cannot scope a tier you were asked to run and the caller did not ask for a full run, report that rather than silently running everything.

## Reporting

Always name the exact command you ran (form and substituted paths) alongside the pass/fail counts. A caller deciding whether a later result still stands needs to know what was actually covered, and "tests passed" without a scope is not an answer.

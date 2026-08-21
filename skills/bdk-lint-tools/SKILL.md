---
name: bdk-lint-tools
description: Project-configured lint/format/typecheck commands from .bdk/settings.json. Preloaded into agents that run static analysis; not user-facing.
allowed-tools: Bash(python3 ${CLAUDE_PLUGIN_ROOT}/scripts/*)
user-invocable: false
---

Lint/format/typecheck command(s) for this project, one block per tier:

!`python3 ${CLAUDE_PLUGIN_ROOT}/scripts/get_settings.py lint-tools`

If the line above reads `run the project's linter/formatter`, `.bdk/settings.json` is not configured — emit one warning line `[bdk] .bdk/settings.json not configured — run /bdk:setup` then detect from project files and proceed under the same policy below. Prefer a project script (`bin/cleanup.sh`, a `Makefile` `lint` target) when one exists and you had to detect.

## Pick the form, not just the command

Each block names a tier and the forms of the same command. `{files}` is a placeholder: replace it with the space-separated paths you were given, quoted.

| Tier | Given a file list | No file list |
|---|---|---|
| `lint`, `format` | `scoped` — these tools take paths natively, so a whole-project sweep on a three-file change is pure waste. | `full` |
| `typecheck` | `incremental` — a typechecker resolves the whole program, so a path list buys little; the cache is what makes a repeat run cheap. Fall back to `full` if no `incremental` form is configured. | `incremental`, else `full` |

The `incremental` form's cache (`.tsbuildinfo` and equivalents) survives between runs in the same worktree, so the second and later checks of a run pay only for the delta. Do not delete it between checks.

If a `lint`/`format` block has no `scoped` form, derive one by appending the paths the tool accepts (`<full> -- {files}` for an npm/yarn/pnpm script, a bare path list for most direct binaries) and say in your report that you derived it, so the settings get fixed once instead of re-derived forever.

## Scope policy

- **Given file paths, check those paths.** Per task, per group, and per fix cycle you get a file list — use it. Findings outside the list are out of scope; do not widen the run to go looking for them.
- **Non-executable content gate.** If every path you were given is yaml/md/json/plain config not feeding build or codegen: skip `typecheck` entirely, and run `lint`/`format` scoped only if the tool supports those file types - otherwise report `nothing to verify for these paths: <list>`. Build-feeding config (tsconfig, lockfiles, codegen schemas) counts as source: when the source partition is empty, `typecheck` must not run.
- The unscoped whole-project sweep belongs to the end-of-run gate, or to a caller who explicitly asked for it.
- Report the exact command you ran (form and substituted paths) with the findings, so a caller can tell what was actually covered.

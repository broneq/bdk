---
name: bdk-lint-tools
description: Project-configured lint/format/typecheck commands (`tools.lint` of the BDK settings). Preloaded into agents that run static analysis; not user-facing.
allowed-tools: Bash(node "${CLAUDE_PLUGIN_ROOT}/dist/bdk.mjs" *) Bash(echo *)
user-invocable: false
---

Lint/format/typecheck command(s) for this project, as the YAML list `tools.lint`, one entry per command:

!`node "${CLAUDE_PLUGIN_ROOT}/dist/bdk.mjs" config show tools.lint 2>&1 || echo "BDK STOP: bdk config show failed (exit $?). Install Node >= 22.13, then run bdk config check."`

If the list above is empty (`[]`), no lint command is configured: emit one warning line `[bdk] no tools.lint entry in .bdk/settings.yaml - run /bdk:setup`, then detect from project files and proceed under the same policy below. If it shows an error or a `BDK STOP` line instead, repeat that line to the user and detect the same way. Prefer a project script (`bin/cleanup.sh`, a `Makefile` `lint` target) when one exists and you had to detect.

## Pick the form, not just the command

Each entry has an `id`, a `tier` (`lint`, `format` or `typecheck`) and the forms of the same command: `command` (the full, unscoped run) plus the optional `scoped` and `incremental`. `{files}` is a placeholder: replace it with the space-separated paths you were given, quoted. When an entry has `when`, follow it: it says when that command is the right one.

| Tier             | Given a file list                                                                                                                                                                                | No file list                  |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------- |
| `lint`, `format` | `scoped` — these tools take paths natively, so a whole-project sweep on a three-file change is pure waste.                                                                                       | `command`                     |
| `typecheck`      | `incremental` — a typechecker resolves the whole program, so a path list buys little; the cache is what makes a repeat run cheap. Fall back to `command` if no `incremental` form is configured. | `incremental`, else `command` |

The `incremental` form's cache (`.tsbuildinfo` and equivalents) survives between runs in the same worktree, so the second and later checks of a run pay only for the delta. Do not delete it between checks.

If a `lint`/`format` entry has no `scoped` form, derive one by appending the paths the tool accepts (`<command> -- {files}` for an npm/yarn/pnpm script, a bare path list for most direct binaries) and say in your report that you derived it, so the settings get fixed once instead of re-derived forever.

## Scope policy

- **Given file paths, check those paths.** Per task, per group, and per fix cycle you get a file list — use it. Findings outside the list are out of scope; do not widen the run to go looking for them.
- **Non-executable content gate.** If every path you were given is yaml/md/json/plain config not feeding build or codegen: skip `typecheck` entirely, and run `lint`/`format` scoped only if the tool supports those file types - otherwise report `nothing to verify for these paths: <list>`. Build-feeding config (tsconfig, lockfiles, codegen schemas) counts as source: when the source partition is empty, `typecheck` must not run.
- The unscoped whole-project sweep belongs to the end-of-run gate, or to a caller who explicitly asked for it.
- Report the exact command you ran (form and substituted paths) with the findings, so a caller can tell what was actually covered.

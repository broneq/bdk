# Design

## Context

`planChecks` (`plugins/bdk/src/check/domain/plan.ts`) fills `{files}` of every item with the whole scope (design D4 of `v3-183-check-run`). The scope comes from the part's `files` (`implement-part`, `conform-part`), the resolved conflict's files (`resolve-conflict`) or the test files of a red run, all root-relative. Rule selection already matches root-relative files against globs with `minimatch` (`plugins/bdk/src/rules/domain/select.ts`), a dependency the plugin ships. The settings schema (`plugins/bdk/src/config/domain/settings.ts`, `Check`) is strict and is the source of the settings Reference.

## Goals / Non-Goals

**Goals:**

- Each check item sees only the scope files its tool understands, in a repository of several packages or languages.
- An item that owns none of the changed files costs nothing on a scoped run.
- One way to match paths in the whole CLI.

**Non-Goals:**

- `/bdk:setup` detecting packages and writing `paths` (follow-up issue; the skill needs its own eval case).
- Running an item inside its package directory (`cwd` per item) or rewriting paths relative to it: a `scoped` command that needs package-relative paths can `cd` itself.
- A full run filtered by `paths`: without a scope there is no file to filter.

## Decisions

### D1. The filter is `paths`, a list of globs on the check item

The key is `paths`, the same name and glob dialect as a rule's `paths` (spec `rule-pack`, `bdk-cli/rules`): `minimatch` with `dot: true`, the scope path with a leading `./` dropped before matching. A user who wrote rule paths already knows it; the CLI keeps one matcher.

Alternatives: `extensions` (`[".py"]`) - cannot tell `api/` from `scripts/` Python and is a second dialect; `root` / `dir` (one package directory) - cannot say "every `.py` file" for a linter that spans the repository, and globs cover a directory as `api/**`; a regular expression - unfamiliar next to rule paths and easy to get wrong in YAML.

`paths` must hold at least one non-empty glob. An empty list would make the item skip on every scoped run, which nobody means; leaving the key out means "every file".

### D2. An item no scope path matches is skipped, and the result says so

With `--scope`, an item whose `paths` match none of the scope paths runs no command: not its `scoped` variant with an empty `{files}` (most runners then test the whole project or fail on no input), and not its full `command` (that is what made multi-package repositories slow). It writes no output file, is no check in `checks`, and is listed under a new result field `skipped` (`kind`, `tool`) and as a `skip` line in the text output, so a caller sees why a configured tool did not run instead of guessing.

Alternatives: a check with a new status `skip` - changes `status`, the verdict and the findings rules for a check that never ran, and every reader of `checks` would have to learn it; silently leaving it out - a model reading the result cannot tell a skipped item from a missing configuration.

When every selected item is skipped the verdict is `none`, as for "nothing configured": nothing checked these files. `implement-part`'s red-test step already treats `none` as "no test tool for these files" and stops with `Kind: environment`; its sentence is reworded to say that (one sentence of an instruction whose meaning widens with this Change, not a rewrite, so no `/skill-creator` run or new eval case: the existing `implement-part` cases still describe its behaviour).

### D3. `paths` gates the item, `scoped` decides the command

An item with `paths` and no `scoped` runs its full `command` when at least one scope path matches, and is skipped otherwise. So `paths` alone already keeps the Python tests from running on a frontend-only part, also for tools that take no file list (`tsc -b`, `mypy`, `cargo`). Without `--scope`, `paths` is not read and every item runs its `command`.

### D4. The path goes into `{files}` as given

Only the match drops `./`; the command gets the scope path the caller wrote, deduplicated and sorted as before, so the rule "scope paths as given" of the result's `scope` field and of `{files}` stays one rule.

### D5. The result keeps `version: 1`

`skipped` is a new field of `checks/<id>.json`. No `bdk` release has shipped the result (#213), and the skills read only `verdict` and the output paths, so the version stays `1`.

## Risks / Trade-offs

- [A glob that matches no file of its package by mistake (`web/*` instead of `web/**`)] → the item is skipped on every scoped run and the result's `skipped` and the `skip` line show it; the item still runs on full runs (review rounds), so a broken package is caught there.
- [Merge of `paths` across layers] → `paths` is a scalar array and is replaced whole by a higher layer (spec `bdk-cli/config`, "Merge"), as `languages` is; documented by the existing Merge requirement.
- [#274 and #278 change `settings.ts` and the "Settings keys" table at the same time] → this Change touches only `Check` and the `tools.*` row; a rebase merges both intents.

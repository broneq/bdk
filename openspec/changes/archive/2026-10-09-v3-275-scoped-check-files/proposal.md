# Proposal

## Why

Tracks #275.

`bdk check run --scope` replaces `{files}` in every check item's `scoped` variant with all scope paths. In a repository of several packages or languages, a part that touches `web/src/a.tsx` hands that file to the `pytest` item of the Python API, and a `.py` file to `eslint`: the scoped checks go red for files their tool does not understand, so the user guide advises leaving `scoped` out there and every check runs its whole command on every part. A filter per item lets each tool see only its own files, and lets an item that owns none of the changed files stay out of the run.

## What Changes

- A `tools.test`, `tools.lint` or `tools.build` item gets an optional `paths`: a list of globs, matched against the scope paths like a rule's `paths` (spec `bdk-cli/rules`): `*` does not cross `/`, `**` matches any number of directories, dot files match.
- With `--scope`, an item with `paths` gets only the scope paths its globs match: its `scoped` variant's `{files}` becomes those paths. An item without `paths` keeps today's behaviour: all scope paths.
- With `--scope`, an item whose `paths` match no scope path is skipped: no command runs and no output file is written. The result lists it under a new `skipped` field (`kind`, `tool`), and the text output prints a `skip` line for it. When every selected item is skipped, the verdict is `none`, as when nothing is configured.
- Without `--scope`, `paths` is not read: a full run runs every item's `command`.
- The settings key is described in the schema, so the settings Reference regenerates with it, and `bdk config check` rejects a `paths` that is not a non-empty list of non-empty strings.
- The monorepo example of the configuration guide gives each item `paths` and a `scoped` variant, and drops the advice to leave `scoped` out.
- `implement-part` says what a verdict `none` of its red-test run means now (no `tools.test` item runs on those files), one sentence.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `bdk-cli/check`: "Run the checks" filters the scope per item by its `paths` and skips an item no scope path matches; "Result file" gains `skipped`; "Check run text output" prints the skipped items.
- `bdk-cli/config`: "Settings keys" lists `paths` on `tools.test`, `tools.lint` and `tools.build` items.

## Impact

- Code: `plugins/bdk/src/check/` (`domain/plan.ts`, `schema/run.ts`, `render/run.ts`, `use-cases/run.ts`, tests), `plugins/bdk/src/config/domain/settings.ts` (`Check`), `plugins/bdk/skills/implement-part/SKILL.md` (one sentence).
- `checks/<id>.json` gains the field `skipped`; `version` stays `1`, since no `bdk` release has shipped the result yet (#213).
- User docs: `docs/guide/configuration.md` (the monorepo example and the text under it, the `scoped` paragraph); the settings Reference and the `bdk check run` Reference regenerated with `pnpm docs:reference`.
- Out of scope: `/bdk:setup` detecting packages and writing `paths` for each item (follow-up issue); #274 and #278 (per-role models) touch the same `settings.ts` but not `Check`.

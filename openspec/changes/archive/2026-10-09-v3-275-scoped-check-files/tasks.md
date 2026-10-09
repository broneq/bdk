# Tasks

## 1. Settings key

- [x] 1.1 Add failing config tests: a `tools.test` item with `paths: ["api/**"]` resolves, `paths: []` and `paths: [""]` are problems naming `tools.<kind>.<id>.paths`; verify they fail
- [x] 1.2 Add `paths` to `Check` in `plugins/bdk/src/config/domain/settings.ts` with its description; verify the tests of 1.1 and the config suite pass

## 2. Check run filters the scope per item

- [x] 2.1 Add failing domain tests in `check/tests/domain.test.ts`: per-item files by `paths` (acceptance case `api`/`web` with `--scope web/src/a.tsx`), `./` dropped for matching and kept in the command, an item with `paths` and no `scoped` runs its command or is skipped, every item skipped, `paths` ignored without a scope; verify they fail
- [x] 2.2 Make `planChecks` return the planned checks and the skipped items; verify 2.1 passes
- [x] 2.3 Add failing use-case tests in `check/tests/use-cases.test.ts`: a skipped item writes no output file, the result lists it under `skipped`, the verdict is `none` when every item is skipped, the text output prints the `skip` line; verify they fail
- [x] 2.4 Add `skipped` to the result schema, the use case and the text renderer, and update the `--scope` flag description; verify 2.3 and the whole `check` suite pass

## 3. Skill wording

- [x] 3.1 Reword the verdict `none` sentence of `plugins/bdk/skills/implement-part/SKILL.md` step 4 to "no `tools.test` item runs on these files"; verify `pnpm check` (skill-check) passes

## 4. Docs

- [x] 4.1 Update `docs/guide/configuration.md`: the monorepo example gives each check item `paths` and a `scoped` variant, the text under it explains `paths` and skipping, and drops the advice to leave `scoped` out; the `scoped` paragraph of the first example names `paths`
- [x] 4.2 Run `pnpm docs:reference` and verify the settings Reference lists `paths` and the `bdk check run` Reference names the new flag text

## 5. Acceptance and gates

- [x] 5.1 End to end with the built CLI in a scratch project: `tools.test` items `api` (`paths: ["api/**"]`) and `web` (`paths: ["web/**"]`), `bdk check run <run-dir> e2e --scope web/src/a.tsx` runs only `web`'s scoped command with `web/src/a.tsx`, and `api` is listed as skipped
- [x] 5.2 Run every check CI runs (`.github/workflows/`: `pnpm check` and the other jobs), `openspec validate v3-275-scoped-check-files --strict` and `openspec validate --specs --strict`; verify all pass

# Tasks

The CLI helper answers a recorded need: the design section "Rules" has the orchestrator put the rules of a role's stage and files into its prompt, and draft 1 measured that rule text in a reviewer's prompt changes detection (`docs/v3-draft1/evals/V3-EVAL-RULES-NOOP.md`, `with` vs `without` gap 0.25); selecting 16 files by stage, glob and language by hand in every skill is what `bdk rules for` computes.

## 1. Frame: repeatable string flag

- [x] 1.1 Write failing tests in `src/shared/cli/tests/run.test.ts`: a flag declared `multiple: true` collects `--files a --json --files b` into `["a", "b"]`; command help marks it `(repeatable)`
- [x] 1.2 Add `Flag.multiple`, list values in `Input.flags` and the help suffix in `src/shared/cli/`; verify the tests of 1.1 pass

## 2. Rule file format and the pack

- [x] 2.1 Write failing domain tests for the rule file schema (`src/rules/tests/rule.test.ts`): valid house and knowledge rules, missing `source`, unknown field, unknown stage, empty text, bad id, `README.md` ignored, frontmatter missing
- [x] 2.2 Implement `src/rules/domain/rule.ts` (frontmatter parse with `yaml`, zod schema, id from the file name, language from `languages/<name>/`); verify 2.1 passes
- [x] 2.3 Write the failing pack test `plugins/bdk/tests/rule-pack.test.ts`: every file under `plugins/bdk/rules/` is valid, ids start with `BDK-` and are unique, every rule has `measured` whose report row holds the bullet with class `effective` or `corrects the model`, and the language packs `javascript`, `typescript`, `react` exist
- [x] 2.4 Write the 16 rule files of design D1 under `plugins/bdk/rules/` from `draft/v3-1:rules/` with the frontmatter of D2 and `rules/README.md` (format, stages, language packs, project rules, admission); verify 2.3 passes

## 3. Selection and the `rules` slice

- [x] 3.1 Write failing tests for `src/rules/domain/select.ts`: selection by stage, by path (globs, dot files, `./`), by language, without files, disabled ids, unknown disabled id warning with closest id, language without rules warning, ordering by origin and numeric id
- [x] 3.2 Implement `domain/select.ts` with `minimatch` (add `minimatch` 10.2.6 to `plugins/bdk/package.json`, `pnpm install`); verify 3.1 passes
- [x] 3.3 Write failing use-case and command tests (`src/rules/tests/use-cases.test.ts`, in-memory `Files`): not configured, config invalid, invalid project rule, `BDK-` project id, project rule selected, files relative to cwd made root-relative, `--json` valid against `schema/for.ts`, text form, unknown `--stage`
- [x] 3.4 Implement `store/rules.ts`, `use-cases/for.ts`, `commands/for.ts`, `render/for.ts`, `schema/for.ts`, `index.ts`; add the `rules` row to `src/slices.ts` and wire `rulesGroup` with the pack directory in `src/main.ts`; verify 3.3 passes and `pnpm lint` passes the architecture rules
- [x] 3.5 Add an end-to-end test of the built CLI in `plugins/bdk/tests/rules-cli.test.ts`: a copy of the plugin with `rules/`, a temporary project with `.bdk/settings.yaml` (`languages: [typescript, react]`), `openspec/` and a project rule; `bin/bdk rules for --stage review --files src/App.tsx --json` selects the React, TypeScript and general review rules and the project rule

## 4. Documentation and acceptance

- [x] 4.1 Update `CLAUDE.md` "Current state" (slice `rules`, the rule pack) and verify the slice list matches `src/`
- [x] 4.2 Check the acceptance signal end to end: selection by stage, path and language is covered by tests (3.1, 3.5), and the pack holds only rules with a measured effect (2.3); run `bin/bdk rules for` by hand in a temporary project and read the text output
- [x] 4.3 Run every check CI runs (`pnpm check`, `claude plugin validate` of the marketplace and every plugin with `--strict`, commitlint of the commit), `openspec validate v3-184-rule-pack-rules-for --strict` and `openspec validate --specs --strict`

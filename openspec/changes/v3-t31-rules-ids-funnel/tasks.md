# Tasks

## 1. Re-measure the 14 undetected bullets (old layout)

- [x] 1.1 Write a failing harness unit test for a patch filter of the `rules-noop` suite (`pnpm eval rules-noop --patches <id,...>` renders only the M2 tests of those patches; an unknown id is a usage error), then implement it in `evals/harness/cli.ts` and `evals/suites/rules-noop/suite.ts`; verify with the harness unit tests and `pnpm eval check`
- [x] 1.2 Fix the seeds of the 14 bullets with detection 0 in both cells (`evals/suites/rules-noop/violations.yaml`, `patches.ts`) so each patch holds exactly one unambiguous violation of its bullet; verify with the suite's patch-application test and `pnpm eval check`
- [ ] 1.3 Run `pnpm eval rules-noop --patches <the 14> --probe`, present the projected cost of the full series to the user and wait for approval; verify the probe row is written under `evals/results/rules-noop/`
- [ ] 1.4 After approval run the full series (cells `with`, `with-prime`, `without`, 5 runs), recompute the 14 classes with T40's rule and append the results to `docs/V3-EVAL-RULES-NOOP.md`; verify with `pnpm eval report rules-noop` and the committed rows

## 2. Classification and the migration report

- [ ] 2.1 Write the failing content test for `rule-pack` "every measured bullet has a row" (T40 ids from `evals/results/rules-noop/` against the rows of `docs/V3-RULES-MIGRATION.md`); verify it fails on the missing report
- [ ] 2.2 Write `docs/V3-RULES-MIGRATION.md`: one row per bullet with T40 id, excerpt, class, spot-check correction, kind, decision (`kept as <id>` or `removed: <reason>`), re-measured M2 result where applicable, then counts per decision and file, applying design D-1 and D-2; verify the content test from 2.1 passes
- [ ] 2.3 Present the report to the user for review of every kind and removal; apply the corrections; verify the user approved it before group 6 starts

## 3. Rule store and settings (kernel)

- [ ] 3.1 Write failing unit tests for the rule store: bundle and `.bdk/rules/` loading with one schema, `BDK-` prefix accepted only in the bundle, id equals file name, tombstones kept, `origin` and `evidence` fields, `knowledge` needs `source` and `verified`, `languages` gating language packs, `rules.disabled` and `unknown-disabled-id`
- [ ] 3.2 Implement the store in `kernel/src/rules/` (reading through `shared/store`, no `log` import) and the rule frontmatter schema change; verify 3.1 passes
- [ ] 3.3 Write failing tests for the settings change: `rules.audit.min-changes` (3) and `rules.prune.uncited-changes` (20) registered, `rules.propose-when.*` and `rules.max-learnings-per-change` refused with their `why`, a `.bdk/prompts/rules/<category>.md` file refused with `unknown-config-key` pointing at `.bdk/rules/`; then move the T31 keys out of `PLANNED_KEYS` in `kernel/src/shared/config/known.ts`, unregister the `rules/*` prompt keys in `kernel/src/rules/config.ts`, and update `settings-spec.test.ts` expectations; verify the tests pass
- [ ] 3.4 Update the dependency-matrix test for `rules` importing `shared` only; verify `kernel/tests/contract/structure.test.ts` and `pnpm knip` pass

## 4. Selection, dispatch, ctx and status (kernel)

- [ ] 4.1 Write failing unit tests for selection (design D-5): role prefix map incl. `PL` for `verifier`, `roles` override, project rules to every rule-reading role, file sets for task, part and artifact targets, glob match through `shared/store/glob.ts`, the ordering (global, specificity, `since`, id), the cap and the truncation count
- [ ] 4.2 Replace `kernel/src/rules/use-cases/selection.ts` with the id-based selection; verify 4.1 passes
- [ ] 4.3 Write failing tests for `dispatch build`: the package stamps `rules` and `rules-truncated`, `template-hash` changes when a selected rule text or id changes and stays when an unselected rule changes; then implement in `kernel/src/dispatch/use-cases/build.ts` and the package schema; verify the tests and the state fixture test pass
- [ ] 4.4 Write failing tests for `ctx skill`: `rules` part renders `- [<id>] <text>` with `(applies: ...)`, `language-rules` read from the pack dirs, the new `project-rules` part, `rules("plan")` for `create-plan`; then implement in `kernel/src/ctx/` and `manifest.ts`; verify the tests, `ctx-skill-output.test.ts` and `skill-context.test.ts` pass
- [ ] 4.5 Write a failing test for `change status` `rulesTruncated` (scenario "rules truncated"), then implement it; verify the test passes

## 5. Commands and the ledger (kernel)

- [ ] 5.1 Write failing E2E tests (`kernel/src/rules/tests/rules.e2e.ts`) for every scenario of `kernel-cli/rules`: `check`, `show <id>` with tombstones and `--ticket` from the package, `explain` with `--role` and `input/not-found`, `prune` (`no-match`, `uncited` silent below 20 Changes), `import` (per bullet, prefix, `paths:` or global, `origin: import`), `export --claude` (two files, project rules only, `--check` with `generated-drift`), `stats` (`recurring` over distinct Changes, `--entries`, `--all`, citations), `accept` (next number above tombstones, `--from` into `origin` and `evidence`, projection regenerated, orchestrator availability, no active Change needed)
- [ ] 5.2 Implement the commands and their output schemas (`schema/cli/output/rules-*.json`, incl. the new `rules-accept.json`); remove `rules add`; verify 5.1 passes and `rules show <id>` no longer answers `kernel/not-implemented`
- [ ] 5.3 Write failing tests for the index version 5 (`findings` table from attempt records, `dispatches.rules` and `rules_truncated`, `entries.applies` and `entries.evidence`, `routed_to` dropped, automatic rebuild from version 4); then implement; verify the tests pass
- [ ] 5.4 Write failing tests for `log add learning --applies` (default from the ticket task's `Files:`, `input/invalid` on another type), `routed` refused by `log add`, `log list` and `log resolve`, and `log route` answering unknown command; then implement in `kernel/src/log/` and remove `route`; verify the tests pass
- [ ] 5.5 Write failing tests for `change close` (no `learning` output field, no `.claude/rules` write, scenario "close proposes no rule"), then remove the routing in `kernel/src/change/use-cases/close.ts` and `schema/outputs.ts`; verify the tests pass
- [ ] 5.6 Write failing tests for `doctor` checks `rule-without-id` (warn, repair `bdk rules import`), `rules-invalid` (fail) and `projection-outdated` (warn), then implement in `kernel/src/service/`; verify the tests pass
- [ ] 5.7 Update the error-code and availability tables used by `cli-contract.test.ts` and `kernel-contract.test.ts` for `rule-format`, `duplicate-rule-id`, `generated-drift`, and the removed `log route` and `rules add`; verify `pnpm test:contract` passes

## 6. The shipped pack

- [ ] 6.1 Write the failing content tests of `rule-pack`: pack files match their directory, `knowledge` rules carry `source` and `verified`, plan rules exist, new language pack without a measurement fails, kept bullets exist in the pack
- [ ] 6.2 Write one file per kept rule under `rules/<category>/` and `rules/languages/<name>/` from the approved report, `BDK-PL-1..3` under `rules/plan/`, and `rules/README.md` (definition and admission); delete the nine category files; verify 6.1 passes and `bdk rules check` exits 0 in the repository
- [ ] 6.3 Point the `rules-noop` suite's bullet reader (`evals/suites/rules-noop/bullets.ts`) at the per-rule layout with the old T40 ids mapped through the report; verify `pnpm eval check` and the suite unit tests pass

## 7. Content and documentation

- [ ] 7.1 Write the failing `role-contracts.test.ts` case "rule ids are cited", then add the "Rule citations (S4)" bullet to the implementer, simplifier, reviewer, pr-reviewer, verifier and design-verifier role skills; verify the test and `pnpm skill-check` pass
- [ ] 7.2 Write the failing content test "definition in the convention and the guide", then rewrite `.claude/rules/quality-rules.md` for rule files, ids and the definition, and rewrite `docs/guide/concepts/quality-and-language-rules.md` and `docs/guide/workflows/rules-hygiene.md` for ids, selection, `rules.disabled`, `log add learning`, `rules stats` and `rules accept`; verify the test, `pnpm docs:build` and the docs drift guards in `pnpm test:contract` pass
- [ ] 7.3 Update `README.md` "Quality Rules", `STARTUP_INSTRUCTIONS.md` "Quality Rules" (no `quality` settings section; rules by id) and the T31 resolution in `docs/V3-IMPLEMENTATION-PLAN.md`; verify `pnpm test:contract` (startup test) passes
- [ ] 7.4 Regenerate `schema/cli` and `schema/state`, run `pnpm build` and `pnpm format`; verify `git diff --exit-code` after a second `pnpm build` and `pnpm format:check`

## 8. Acceptance

- [ ] 8.1 In a fixture project with a scoped project rule (`applies: src/api/**`) and a global one: `dispatch build` for a task touching `src/api/x.ts` stamps both ids, for a task touching `docs/a.md` only the global one; `rules show --ticket` prints exactly the stamped ids with their text; verify by running `dist/bdk.mjs` end to end
- [ ] 8.2 In the same fixture: three `log add learning` entries with the same fingerprint in three Changes appear in `rules stats` `recurring`, two do not; `rules accept --from` writes the rule and regenerates `.claude/rules/bdk-generated-scoped.md` with the `paths:` union; `rules export --claude --check` exits 0, and after a hand edit exits with `generated-drift`; `change close` writes no rule
- [ ] 8.3 Run `pnpm lint && pnpm format:check && pnpm typecheck && pnpm knip`, `pnpm test:unit`, `pnpm test:e2e`, `pnpm test:contract`, `pnpm skill-check`, `pnpm eval check` and `pnpm docs:build`; verify all pass
- [ ] 8.4 Run `openspec validate v3-t31-rules-ids-funnel --strict`; verify it reports the change valid

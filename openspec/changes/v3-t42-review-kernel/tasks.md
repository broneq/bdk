# Tasks

## 1. Plan record and probe

- [x] 1.1 Record the T42 split in `docs/V3-IMPLEMENTATION-PLAN.md` like T41's delivery list: `v3-t42-review-kernel`, `v3-t42-review-skills`, `v3-t42-review-report`, `v3-t42-tools`, `v3-t42-craft`, each with its scope and the Lavish decision IDs; correct "13 bdk-* meta-skills" and "eight agent files" to the repository's actual 8 meta-skills and 12 v2 agents to remove (E); verify by reading the section back
- [x] 1.2 Probe in a scratch repository with the built bundle: a `small` Change with two plan parts executed through `seedV3`-style kernel calls, `attempt open review-fix <change>`, `dispatch build <change> reviewer <ticket>`, `log add finding --ticket`, `bdk measure`; record the outputs and the package size of a Change-target reviewer, so the failing tests of groups 2-6 start from observed output (probe 2026-10-03, bundle 2.7.0: two tiny parts executed through task tickets, steps, `attempt close ok`, `commit` and `part done`; `attempt open review-fix <change>` returns `steps` simplify, tests-scoped, lint and `of: 2`; a Change-target `reviewer` package is 5 043 bytes with every role rule; `log add finding --ticket` stamps `source: agent:reviewer`; `measure HEAD~2` gives `modules: [src]`)

## 2. Settings: coverage and review keys (D5, D7)

- [x] 2.1 Failing tests (`kernel/src/config/tests/`): `tools.test[].coverage` accepts `{command, report, format: lcov|cobertura, min}`, refuses `min: 120`, `format: jacoco`, an unknown field, and `coverage` on a `tools.lint` item, each naming the field; `review.group.max-files` defaults to 30 and refuses 2; `review.risks` defaults to the five items with `enabled: true`, merges a project item by `id` and appends a new one
- [x] 2.2 Tool entry schema, the `review.group` (consumer `review`) and `review.risks` (consumer `dispatch`) modules, `pnpm build` regenerates `schema/settings.json`; tests of 2.1 green

## 3. State: new fields (D1, D2, D6)

- [x] 3.1 Failing tests (`kernel/src/shared/` state schemas): ledger `group`, `level` only on `finding`, `blocker`, `observation`; `head` only on a `report` with `group: merge`; package `group` with `files` both or neither; envelope `group` and `role: orchestrator`; manifest `group`, and `tool` required on kind `coverage`
- [x] 3.2 Schemas and the layout rows of grouped packages and reports, `pnpm build` regenerates `schema/state/`; tests of 3.1 green (the two-branch merge case of a `level` rewrite moves to 5.3, where `log triage` exists)

## 4. Ticket references and group packages (D1, D8, D9)

- [ ] 4.1 Failing unit and E2E tests (`kernel/src/dispatch/tests/`, `kernel/tests/`): the reference parser accepts `A-x` and `A-x@p01`, refuses `@P_01`, a 33-character group and a group on a `task-redispatch` ticket; `dispatch build --group` on a `review-fix` ticket writes `<target>-<role>-<ticket>-<group>.md` with `group`, `files`, `report` and leaves the record's `package`; two groups coexist; a rebuild of a group replaces it; `--group merge`, `--file` without `--group`, a missing `--range` for `reviewer` are `input/invalid-argument`; group rules follow `--file` (`API-1` in, `UI-1` out); a 30-file group stays under 12 288 bytes; the `Review` section holds range, files, diff command, part path, intent paths and focus
- [ ] 4.2 Failing tests for the `integration-reviewer` package and the gate runner: adapter `reader`, prefix set `ARCH`, `SEC`, `TQ`, a `Risks` section with the enabled items; a grouped `runner` package's `Checks` lists `tests-full` commands, the coverage command with its `bdk evidence coverage` line and `lint-full` commands, each record line on `<ticket>@gate`; an ungrouped runner on the same ticket keeps `tests-scoped` and `lint`
- [ ] 4.3 Implement the reference parser and group resolution in `shared/store`, `dispatch build --group|--file|--part|--range|--focus`, `dispatch show <ticket>@<group>`, `rules show --ticket <ticket>@<group>` and the role prefix set; `pnpm build` regenerates `schema/cli/`; tests of 4.1 and 4.2 green
- [ ] 4.4 Role skill `skills/roles/integration-reviewer/SKILL.md` (`agent: bdk:reader`, contract per `specs/role-contracts`, at most 4 096 bytes) and the `Review groups` paragraph in `skills/roles/reviewer/SKILL.md`; failing contract tests first (`kernel/tests/contract/role-contracts.test.ts`: ten roles, the adapter map row, P3 wording over five bodies, the group reference and `Risks` named); `bdk export agents --host claude` output unchanged; `pnpm skill-check` green

## 5. Ledger: grouped writes, merge report, triage (D2, D6)

- [ ] 5.1 Failing unit and E2E tests (`kernel/src/log/tests/`): `log add --ticket A@p02` stamps `group` and `source: agent:reviewer`; `log ingest --ticket A@p01` stores at the group report path; a group report naming another group's entry is `policy/entries-missing`; `log ingest --ticket A@merge` stores `reports/<target>-merge-<ticket>.md` with `role: orchestrator`; `log add report --ticket A@merge` stamps `head`, `source: kernel` and refs `review`; `log add finding --ticket A@merge` is `input/invalid-argument`
- [ ] 5.2 Failing tests for `bdk log triage`: the example output validates; `not-a-problem` resolves and requires `--reason`; a `decision` is `input/invalid-argument`; a resolved entry is `policy/invalid-transition`; a re-triage appends a second line; `input/not-found`
- [ ] 5.3 Implement; the two-branch merge test (`kernel/tests/contract/state-merge.test.ts`) runs `log triage` on one branch next to `log resolve` on the other; command records with `refusals`, rule catalogue cells, `schema/cli/output/log-triage.json`; tests of 5.1 and 5.2 green

## 6. Evidence: grouped records and coverage (D5)

- [ ] 6.1 Failing tests (`kernel/src/evidence/tests/`): `evidence record tests-full --ticket A@gate` stamps `group` and the Change tree hash; `evidence record coverage` is `input/invalid-argument`; lcov and Cobertura fixtures parse, a Cobertura file read as lcov is refused naming `lcov`; only added lines count (200-line file, 10 added lines); the suffix match maps `SF:src/log/add.ts` to `kernel/src/log/add.ts`, a tie goes to `unmeasured`; an unlisted file goes to `unmeasured`; `percent: null` with no instrumented line; 17 of 20 lines with `min: 90` is `fail` with three `uncovered` lines; no `min` is `pass`; a task-target ticket is `policy/no-open-ticket`
- [ ] 6.2 Implement the two parsers as pure functions, the Change base and added-line reader in `shared/store`, `bdk evidence coverage`; `schema/cli/output/evidence-coverage.json`; tests of 6.1 green

## 7. Graph: full gate and the review verdict (D2, D4, D6)

- [ ] 7.1 Failing tests (`kernel/src/graph/tests/`, E2E): the registry holds eighteen kinds; `tests-full` and `lint-full` nodes exist in every graph variant before `review`, which requires them; a `fail` manifest leaves the node not done; `tests-full` with a failing or missing coverage manifest for an entry with `min` is not done and `explain` names it; a fix changing a part file stales both; `bdk done lint-full` is `policy/invalid-transition` naming `bdk evidence record`; `bdk done review` is refused on `merge-report` for a group report, on `triaged` for an untriaged entry of the round, on `blockers` for a live `level: blocker` entry from execute, and passes when all three hold
- [ ] 7.2 The `change-check` base, both kinds, `pipeline/pipeline.yaml` nodes and their instruction templates, the three verdict checks; `pnpm build` regenerates `schema/pipeline.json`; tests of 7.1 green

## 8. `bdk review plan` (D3)

- [ ] 8.1 Failing tests (`kernel/src/review/tests/`, E2E in a scratch repository): the example output validates; first round anchors on the parent of the commit adding `change.md`; a `merge` report's `head` anchors the delta; `--full`, `--base`, both together refused; groups by part, `unplanned`, `integration` in order; 25 + 20 files split into `p02-1` and `p02-2`; no plan gives `m1`, `m2`; `dirty` names an unstaged file; an empty range has no groups; `runtime/git-missing`
- [ ] 8.2 The `review` slice (`commands/`, `use-cases/`, `domain/` grouping as a pure function), its registration, the slice table and the import rule (`review` imports only `measure`); `schema/cli/output/review-plan.json`; `kernel/tests/structure.test.ts` green; tests of 8.1 green

## 9. Documentation

- [ ] 9.1 `docs/guide/reference/artifacts.md`: the review stage's `tests-full`, `lint-full` and coverage, groups and the merge report, triage levels; `review.risks` and `tools.test[].coverage` where the guide documents settings; `pnpm docs:build` green

## 10. Acceptance

- [ ] 10.1 Kernel E2E scenario of one review round end to end with the built bundle: `attempt open review-fix`, `review plan`, two group packages and an integration package, grouped findings and reports, a gate runner's `tests-full`, `lint-full` and a passing coverage record, triage of every entry, the `merge` report and `bdk done review` passing; then a second round where a triaged blocker and a fix commit make `review plan` return only the fix's files
- [ ] 10.2 Sync the main specs with the deltas
- [ ] 10.3 Full gate: `pnpm build`, `pnpm lint`, `pnpm format:check`, `pnpm typecheck`, `pnpm knip`, `pnpm test:unit`, `pnpm test:e2e`, `pnpm test:contract`, `pnpm skill-check`, `pnpm docs:build`, `pnpm eval check`, `pnpm lint:py`, `pytest tests/unit/`
- [ ] 10.4 `openspec validate v3-t42-review-kernel --strict` and `openspec validate --specs --strict`

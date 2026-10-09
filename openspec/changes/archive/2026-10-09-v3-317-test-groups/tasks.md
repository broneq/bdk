# Tasks

## 1. Settings: `when` on check items, `scoped` removed

- [x] 1.1 Write failing tests in `plugins/bdk/src/config/tests/` for `when` (accepted points, a repeated point, an unknown point, an empty list) and for a layer setting `scoped` (problem naming `tools.<kind>.<id>.scoped` and the rewrite); move every existing `scoped` fixture in the config tests to `when`; see them fail
- [x] 1.2 Change `plugins/bdk/src/config/domain/settings.ts`: add `when`, drop `scoped` with the custom problem; keep `bdk config set tools.test.unit.when "[part]"` and the describe output working; see the config tests pass

## 2. `bdk check run --at` and `--changed`

- [x] 2.1 Write failing tests in `plugins/bdk/src/check/tests/domain.test.ts` and `use-cases.test.ts` for the spec scenarios: items of one point, `{files}` items with and without files (`no-files`), `paths` gating a whole command, skip reasons, result `version: 2` with `at` and `changed`, the union of `--scope` and changed files; see them fail
- [x] 2.2 Write failing tests in `plugins/bdk/tests/check.test.ts` (real git repository): changed files against `HEAD` (modified, deleted left out, staged new, untracked, ignored left out), an unknown revision (`usage/invalid-argument`), `--at merge`, outside a work tree (`env/not-a-repo`), the text output's first line; see them fail
- [x] 2.3 Implement `--at` and `--changed` in the check slice (`commands/run.ts`, `domain/plan.ts`, `use-cases/run.ts`, `render/run.ts`, `schema/run.ts`), the changed-files reader on `shared/git`; see the check tests and `pnpm lint` (architecture rules) pass

## 3. Wave state in `state.json`

- [x] 3.1 Write failing tests in `plugins/bdk/src/run/tests/` for `waves` (valid, an invalid wave status naming `waves.<n>.status`, a file without `waves`) and for row 4 holding while a wave is not `done`, its reason naming the wave; see them fail
- [x] 3.2 Add the optional `waves` to `plugins/bdk/src/run/store/status.ts` and row 4 in `run/domain/status.ts`; see the run tests pass

## 4. Execute blocks (skills, with /skill-creator)

- [x] 4.1 Eval cases first: update `implement-part-csv` graders so the red run uses `--at part --kind test` and the part check `--at part --changed HEAD`; add `conform-part` grading that a clean part writes no `checks/conform-01.json`; add the case `resolve-conflict-wave` (two green parts, red together: `balance()` rejects an undated entry in one, the other's test builds undated entries) grading `execute/wave-1.md`, the dated test, the kept rule and nothing committed; update the fixtures under `plugins/bdk/evals/fixtures/` that write `scoped` to `{files}` items with `when`
- [x] 4.2 Rewrite `skills/implement-part/SKILL.md` with /skill-creator: red run `--at part --kind test --scope`, verdict `none` as an environment blocker, part checks `--at part --changed HEAD`; `pnpm test` loads its cases
- [x] 4.3 Rewrite `skills/conform-part/SKILL.md` with /skill-creator: check only after an edit, else name the implementer's check unchanged
- [x] 4.4 Rewrite `skills/resolve-conflict/SKILL.md` with /skill-creator: `merge-<id> --at part --scope`, and the `--wave <n> --base <commit>` repair with its report `execute/wave-<n>.md`
- [x] 4.5 Try the three blocks in a separate test project started with `claude --plugin-dir` on the `resolve-conflict-wave` and `implement-part-csv` cases; record the result in the PR

## 5. Execute lead and review round (skills, with /skill-creator)

- [x] 5.1 Eval cases first: add the case `execute-wave-check` (two parts of one wave green alone, red together) grading `checks/wave-1.json` with `at` `wave`, the repair commit, `state.json` wave 1 `done` and `execute/result.md` `## Waves`; the `execute-resume-*` cases need no change, since their fixtures hold no `waves` and row 4 then holds as before; update the review-round cases or fixtures so `round-N.json` has `at` `review`
- [x] 5.2 Rewrite `skills/execute-waves/SKILL.md` with /skill-creator: record `waves.<n>.base`, the wave check after the wave, the repair and its escalation, resume before the next wave, `## Waves` in the result; and `skills/execute/SKILL.md` for the wave blocker reply
- [x] 5.3 Rewrite `skills/review-round/SKILL.md` with /skill-creator: reviewers and `bdk check run ... --at review --changed <base>` in one message, then E2E tester and integration reviewer, then the judge
- [x] 5.4 Try `/bdk:execute` on `execute-wave-check` in a separate test project started with `claude --plugin-dir`; record the result in the PR

## 6. Setup (skill, with /skill-creator)

- [x] 6.1 Eval cases first: replace `setup-web-app/graders/test-scoped.md` and `setup-web-no-playwright/graders/test-scoped.md` with `when` graders (a vitest `{files}` item at `part`, `pnpm test` with `wave`); grade in `setup-web-app` that no item without `{files}` has `paths`; add a re-run case or grader for a `scoped` item rewritten into two items
- [x] 6.2 Rewrite `skills/setup/SKILL.md` and `references/stacks.md` with /skill-creator: the `when` table, `-changed` items with `paths`, the permission rule prefix of a `{files}` command, the `scoped` rewrite; `pnpm test` loads the cases

## 7. Docs

- [x] 7.1 `docs/guide/configuration.md`: the item shape (`command` with `{files}`, `when`, `paths`, `timeout`), a YAML example per point, the migration from `scoped`, and that ports and instances of a heavy suite are the project's own concern
- [x] 7.2 `docs/concepts/orchestrators.md` ("Where execute runs your checks" and review): the three points, the wave check and its repair, the review order; `docs/concepts/e2e.md`: the E2E tester runs after the check run; `docs/concepts/run-state.md`: `waves`, `checks/wave-<n>.json`, `execute/wave-<n>.md`; `docs/concepts/cli-config-hooks.md`: `/bdk:execute-waves` runs `bdk check run`; `docs/guide/first-run.md`: what setup writes
- [x] 7.3 `scripts/docs-reference/names.test.ts` and any other test naming `scoped`; run `pnpm docs:reference` and see `pnpm check` pass the docs name check

## 8. Gates

- [x] 8.1 Acceptance: in a scratch git repository with `.bdk/settings.yaml` holding a `{files}` item at `part` and a whole item at `wave, review`, `bdk check run <run-dir> 01 --at part --changed HEAD` runs only the `{files}` item on the changed files, and `--at wave` only the whole item
- [x] 8.2 `pnpm docs:reference` leaves no diff, `pnpm check` passes, the other jobs of `.github/workflows/pr.yml` pass locally, `openspec validate v3-317-test-groups --strict` and `openspec validate --specs --strict` pass

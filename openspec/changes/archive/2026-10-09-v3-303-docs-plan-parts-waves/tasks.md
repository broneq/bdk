# Tasks

## 1. Problem texts (test first)

- [x] 1.1 Add a test in `plugins/bdk/src/plan/tests/check.test.ts`: `PROBLEMS` has exactly the keys of `CHECKS`, each with a non-empty `meaning` and `fix`; run it and see it fail
- [x] 1.2 Add `PROBLEMS` to `plugins/bdk/src/plan/domain/check.ts`, typed `Readonly<Record<Check, ProblemDoc>>`; run the test green

## 2. Reference generator (test first)

- [x] 2.1 Add a test in `scripts/docs-reference/model.test.ts`: the rendered `bdk/cli.md` holds a `plan-check-problems` section with a row per kind of `CHECKS`, and the row kinds equal `CHECKS`, so a kind without its row fails it; run it and see it fail
- [x] 2.2 `scripts/docs-reference/model.ts`: add `planProblems` to `Model`, read from `PROBLEMS` in `CHECKS` order
- [x] 2.3 `scripts/docs-reference/render.ts`: render the problems table under `bdk plan check`; run the tests green

## 3. Docs

- [x] 3.1 `docs/concepts/stages.md`: section "How a plan is cut" under Plan, linking to `/reference/bdk/cli#plan-check-problems`
- [x] 3.2 `docs/guide/workflow.md`: link the plan stage to that section
- [x] 3.3 Run `pnpm docs:reference`; check the rendered pages in the local docs site

## 4. Gates

- [x] 4.1 `pnpm check`, every check of `.github/workflows/`, `openspec validate --specs --strict`

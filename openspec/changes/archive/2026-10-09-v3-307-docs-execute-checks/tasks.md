# Tasks

## 1. Docs

- [x] 1.1 `docs/concepts/orchestrators.md`: part flowchart with the red acceptance tests, the part checks (three runs) and the conform checks; merge flowchart with the checks of `/bdk:resolve-conflict`
- [x] 1.2 `docs/concepts/orchestrators.md`: section "Where execute runs your checks" with a table of every check run, the scope rule and what is not checked after a wave merge
- [x] 1.3 `docs/concepts/stages.md` (Execute) and `docs/guide/workflow.md` (Execute): when the tests run, linking to that section; the Guide no longer says the conformer alone runs the checks
- [x] 1.4 `docs/concepts/gates-and-budgets.md`: the three check runs inside one implementer run versus `policy.budgets.part-attempts`
- [x] 1.5 Run `pnpm docs:reference`; check the rendered pages and diagrams in the local docs site, light and dark

## 2. Gates

- [x] 2.1 `pnpm check`, every check of `.github/workflows/`, `openspec validate --specs --strict`

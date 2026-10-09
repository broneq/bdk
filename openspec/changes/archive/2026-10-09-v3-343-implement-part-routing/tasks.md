## 1. Eval cases

- [x] 1.1 Add the orchestrator case `plugins/bdk/evals/execute-one-part/` (fixture `ledger-planned.sh`, prompt `/bdk:execute add-csv-export 01`; graders: lists the plan parts, no Agent call, no Write or Edit (`writes-nothing`), reply names `/bdk:implement-part add-csv-export 01`) and run it against the current skill to see it fail
- [x] 1.2 Name the case in `plugins/bdk/evals/README.md` with its command

## 2. Skills (with /skill-creator)

- [x] 2.1 `skills/execute/SKILL.md`: description says it builds every part and names `implement-part` for one part; step 1 stops on a part id and names `/bdk:implement-part <change> <part-id>`
- [x] 2.2 `skills/implement-part/SKILL.md`: description front-loads one part, not the whole plan
- [x] 2.3 Run `execute-one-part` (1 run) and `implement-part-csv` (6 runs) and record the results in `plugins/bdk/evals/README.md`

## 3. Docs

- [x] 3.1 `docs/guide/workflow.md` (Execute) and `docs/concepts/orchestrators.md` (`/bdk:execute`): one part is built with `/bdk:implement-part`
- [x] 3.2 Run `pnpm docs:reference`

## 4. Gates

- [x] 4.1 `pnpm check`, every check in `.github/workflows/`, `openspec validate --specs --strict`

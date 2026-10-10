# Tasks

## 1. Eval cases

- [x] 1.1 Add the grader `no-denied-call` (the regex of `plan-fresh`, #354) to every `judge-*`, `review-group-*`, `review-integration-*` and `triage-*` case (design D5)
- [x] 1.2 Run `plugins/bdk/tests/evals.test.ts`: every case loads

## 2. Skill text

- [x] 2.1 With `/skill-creator`: `judge`, `review-group`, `review-integration` - each `bdk` call the whole Bash command with literal arguments, the `--workdir` exception, files through Read/Grep/Glob, every inline `bdk` call with the full path (design D1 to D4)
- [x] 2.2 With `/skill-creator`: `triage`, the same rule for `bdk` and Lavish calls

## 3. Measurement

- [x] 3.1 Run `judge-*` 3 times with the issue's command, and the `review-*` and `triage-*` cases once with their README grants; record in design "Measurements" and `plugins/bdk/evals/README.md`

## 4. Docs

- [x] 4.1 `docs/concepts/agents.md`: the review blocks and `/bdk:triage` run each `bdk` call as a Bash command of its own with literal arguments, so the permission rule `/bdk:setup` writes matches it; no diagram changes (no step, exit, command, key, file or agent of a flow changes); run `pnpm docs:reference`

## 5. Gates

- [x] 5.1 Run every CI check (`.github/workflows/`), `openspec validate v3-376-review-evals-compound-bdk-calls --strict` and `openspec validate --specs --strict`

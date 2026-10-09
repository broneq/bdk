# Tasks

## 1. Eval cases

- [x] 1.1 Add the grader `no-denied-call` to `plugins/bdk/evals/plan-fresh/` and `plugins/bdk/evals/plan-model-effort/` (design D6); the failing runs are the measured `plan-model-effort` runs
- [x] 1.2 Run `plugins/bdk/tests/evals.test.ts`: both cases load

## 2. Skill and agent text

- [x] 2.1 With `/skill-creator`: `/bdk:plan` check block and step 5 (design D1, D3, D4)
- [x] 2.2 With `/skill-creator`: `verify-plan` step 2, `bdk plan check` as a Bash command of its own
- [x] 2.3 `agents/verifier.md`: commands of their own, files through Read/Glob/Grep, a denied command returns no verdict (design D2, D4)
- [x] 2.4 Restore `openspec/changes/archive/2026-10-09-v3-292-plan-evals-denied-check/` (design D5)

## 3. Measurement

- [x] 3.1 Run every `plan-*` orchestrator case 3 times with the README command in a plain terminal pane; record in design "Measurements" and `plugins/bdk/evals/README.md`

## 4. Docs

- [x] 4.1 `docs/concepts/orchestrators.md`, `/bdk:plan`: a verifier pass without a verdict stops the stage; run `pnpm docs:reference`

## 5. Gates

- [x] 5.1 Run every CI check (`.github/workflows/`), `openspec validate v3-342-plan-evals-permission-denials --strict` and `openspec validate --specs --strict`

# Tasks

## 1. Check

- [x] 1.1 `plugins/bdk/src/plan/domain/part.ts`: read the scenarios under `## Acceptance scenarios` and the `Verified by:` lines under `## Tasks` (one section reader shared with the task count)
- [x] 1.2 `plugins/bdk/src/plan/domain/check.ts`: the check `present-scenario` after `max-bytes`, its meaning and fix in `PROBLEMS` (design D3)
- [x] 1.3 Unit tests in `src/plan/tests/part.test.ts` and `check.test.ts`; run the check on the two kept plans of #423 (it lists the four and six marked scenarios of part 02)

## 2. Skills

- [x] 2.1 `skills/plan-draft/SKILL.md`: one `Verified by:` line per present scenario, an example, the check's problem in step 5 (design D2)
- [x] 2.2 `skills/plan-draft/references/part-example.md`: a present scenario tested beside a new one
- [x] 2.3 `skills/execute-waves/SKILL.md`: `present-scenario` notes and goes on (design D4)
- [x] 2.4 `openspec/schemas/bdk/schema.yaml`: the suffix and the line of a present scenario in the plan instruction

## 3. Evals

- [x] 3.1 `plan-draft-household-book`: the grader `present-endings` (design D5)
- [x] 3.2 `verify-plan-present-scenarios/parts/01.md`: own lines for the present scenarios, so the case passes `bdk plan check` and fails on its two seeded markers only
- [x] 3.3 Run `plan-draft-household-book` 3 times on `sonnet`, `--ablation none`; record the result in design "Measurement" and `plugins/bdk/evals/README.md`

- [x] 3.4 File the out-of-scope finding of the runs: #430 (4 waves in 1 of 3 runs, foundation part at the byte limit)

## 4. Docs

- [x] 4.1 `docs/concepts/stages.md`, "When you review a plan": the marker and the `Verified by:` line of a present scenario
- [x] 4.2 Regenerate the Reference with `pnpm docs:reference` (`docs/reference/bdk/cli.md`)

## 5. Gates

- [x] 5.1 Sync the main specs, `openspec validate --specs --strict`, `pnpm check`

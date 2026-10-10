# Tasks

## 1. Fixture and cases

- [x] 1.1 Write the fixture `plugins/bdk/evals/fixtures/tally-modified.sh` (design D5)
- [x] 1.2 Write the cases `plan-draft-present-scenarios` and `verify-plan-present-scenarios` with their graders, and see both fail without the new text (the baseline arm)
- [x] 1.3 Run `plugins/bdk/tests/evals.test.ts` and the free eval check: cases load, scaffolds exit 0

## 2. Skills

- [x] 2.1 Extend step 2 and step 4 of `plugins/bdk/skills/plan-draft/SKILL.md` with `/skill-creator` (design D1-D3)
- [x] 2.2 Extend step 3 of `plugins/bdk/skills/verify-plan/SKILL.md` with `/skill-creator` (design D4)
- [x] 2.3 Run both cases with and without the plugin, 3 runs per arm, and record the results in design "Results" and `plugins/bdk/evals/README.md`

## 3. Docs

- [x] 3.1 `docs/concepts/stages.md` and `docs/concepts/orchestrators.md`: the plan marks present scenarios and the verifier checks the markers; check the diagrams that draw the plan stage; run `pnpm docs:reference`

## 4. Gates

- [x] 4.1 Check the Acceptance signal on the cases, run every CI check (`.github/workflows/`), `openspec validate v3-382-plan-draft-present-scenarios --strict` and `openspec validate --specs --strict`

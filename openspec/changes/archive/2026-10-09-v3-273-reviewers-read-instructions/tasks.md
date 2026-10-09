## 1. Eval cases first

- [x] 1.1 Write the fixture `plugins/bdk/evals/fixtures/monthly-report-instructions.sh` (design D5); verify in a scaffolded scratch workspace that `CLAUDE.md` is on `main`, `git log main..monthly-report` holds the three Change commits, and the `range` of `round-1/groups.json` resolves (`git diff --stat <range>`)
- [x] 1.2 Write the cases `review-group-instruction` and `judge-instruction` (prompt, `case.yaml`, `scaffold.sh`, graders); the judge scaffold writes its two findings with ids from `bdk findings add`; verify with the free check `pnpm exec vitest run plugins/bdk/tests/evals.test.ts`
- [x] 1.3 Probe both cases with the plugin before the skill change (`--runs 1 --ablation none`) and record whether they fail (the baseline the skill change must beat)

## 2. The blocks

- [x] 2.1 Rewrite `skills/review-group/SKILL.md` with `/skill-creator` (design D1-D3): read the instructions in step 2 (under `--workdir` too), check them in step 3, cite them with `--rule <path>` in step 4
- [x] 2.2 Rewrite `skills/judge/SKILL.md` with `/skill-creator` (design D4): read a cited instruction file in step 2, check the citation in step 3
- [x] 2.3 Run `bdk-skill-kit:skill-check` on both skills and fix every finding; `claude plugin validate plugins/bdk --strict`
- [x] 2.4 Add the new cases to the review paragraph of `plugins/bdk/evals/README.md`

## 3. Docs

- [x] 3.1 Update `docs/concepts/stages.md` (review table: `/bdk:review-group` checks instructions, `/bdk:judge` reads the cited one), `docs/concepts/rules.md` (instructions paragraph and the review roles), `docs/concepts/findings.md` (a finding cites a rule or an instruction file); run `pnpm docs:reference`

## 4. Acceptance end to end

- [x] 4.1 Build the plugin; run `review-group-instruction`, `judge-instruction`, `review-group-logic-bug` and `judge-levels` with the plugin through `claude plugin eval` with the review Bash grants, and record the results in design D5
- [x] 4.2 Remove the flaky `read-part` grader of `review-group-logic-bug` (it failed in 1 of 3 runs before this Change, design D5); rerun the case
- [x] 4.3 Run every CI check (`pnpm check`, `claude plugin validate` of the marketplace and every plugin), `openspec validate v3-273-reviewers-read-instructions --strict` and `openspec validate --specs --strict`

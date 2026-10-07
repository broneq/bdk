## 1. Eval cases first

- [x] 1.1 Write the shared fixture `plugins/bdk/evals/fixtures/monthly-report.sh` (design D7): configured BDK project, `ledger` CLI on `main`, branch with the Change `monthly-report` in two commits (parts 01 and 02, seeded logic and seam bugs, passing tests), recorded `round-1/groups.json`
- [x] 1.2 Write the cases `review-group-logic-bug`, `review-integration-seam`, `judge-levels` (prompt, `case.yaml`, `scaffold.sh`, graders per design D7); the scaffolds of the integration and judge cases add their `findings.jsonl`, with ids from the CLI's dedupe rule
- [x] 1.3 Run the free check (`pnpm exec vitest run plugins/bdk/tests/evals.test.ts`) and see the new cases load; confirm in a scaffolded workspace that `node --test` passes and `ledger report` shows the seam bug

## 2. `bdk findings report` (problem measured: the host refuses a subagent's Write of report.md)

- [x] 2.1 Failing tests first: `src/findings/tests/commands.test.ts` cases for the spec scenarios of "Round report" (judged round, same log same report, replace, no log yet, missing directory) and a built-CLI case in `tests/findings-cli.test.ts`
- [x] 2.2 Implement the verb in the `findings` slice: `commands/report.ts`, `use-cases/report.ts`, `render/report.ts`, `schema/report.ts`, `store/log.ts` (write the report); register it in `index.ts`

## 3. The blocks

- [x] 3.1 Build `skills/review-group/SKILL.md` with `/skill-creator` (design D1-D3)
- [x] 3.2 Build `skills/review-integration/SKILL.md` with `/skill-creator` (design D2, D4)
- [x] 3.3 Build `skills/judge/SKILL.md` with `/skill-creator` (design D5, D6)
- [x] 3.4 Write the agents `agents/reviewer.md`, `agents/integration-reviewer.md`, `agents/judge.md` (design D1)
- [x] 3.5 Run `bdk-skill-kit:skill-check` on the skills and agents and fix every finding; `claude plugin validate plugins/bdk --strict`
- [x] 3.6 Add the review cases, their Bash grants and the run command to `plugins/bdk/evals/README.md`

## 4. Acceptance end to end

- [x] 4.1 Build the plugin; in a test project scaffolded from the fixture outside this repository, run the three blocks in order through their agents (`claude -p --plugin-dir`), and check the log, the levels and `report.md`
- [x] 4.2 Run `/bdk:review-group` standalone without arguments in a test project and check the `manual` round directory
- [x] 4.3 Run the three eval cases with and without the plugin, fix skills or graders until each shows a positive `Δ` and the seam grader passes with the plugin; record the results in design D7
- [x] 4.4 Run every CI check (`pnpm check`, `claude plugin validate` of the marketplace and every plugin), `openspec validate v3-193-review-blocks --strict` and `openspec validate --specs --strict`

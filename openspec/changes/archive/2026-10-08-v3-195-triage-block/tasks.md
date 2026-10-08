## 1. `defer` without an issue in the CLI (D7)

- [x] 1.1 Write failing tests in `plugins/bdk/src/findings/tests/`: `decide ... defer` without `--issue` appends a `decision` line without `issue` and `list` shows it; `decide ... fix --issue` stays `usage/invalid-argument`; a `fix` line carrying an `issue` is skipped by the fold
- [x] 1.2 Make `issue` optional for `defer` in `domain/events.ts` and update the `--issue` flag description; run the slice tests and lint

## 2. Eval cases first (D9)

- [x] 2.1 Write the shared fixture `plugins/bdk/evals/fixtures/monthly-report-judged.sh`: `monthly-report.sh`, then round 1 with the four findings of `judge-levels`, one `level` line each, and `report.md` written by `bdk findings report`'s format
- [x] 2.2 Write the cases `triage-auto-policy`, `triage-lavish` (with a `lavish-axi` stand-in answering the poll) and `triage-ask` (stand-in failing to open), each with its graders and tag `block`
- [x] 2.3 Run the free check (`pnpm exec vitest run plugins/bdk/tests/evals.test.ts`) and see the new cases load

## 3. The `triage` skill (D1-D6, D8)

- [x] 3.1 Write `plugins/bdk/skills/triage/SKILL.md` with `/skill-creator`: config block, round selection, unleveled stop, auto-mode table, manual surfaces (Lavish, `AskUserQuestion`, reply), defer with an issue, `bdk findings decide` per decision, report refresh, reply
- [x] 3.2 Run `bdk-skill-kit:skill-check` on the skill and fix every finding; `claude plugin validate plugins/bdk --strict`
- [x] 3.3 Add the triage cases, their grants and the run command to `plugins/bdk/evals/README.md`

## 4. Try it in a separate test project

- [x] 4.1 Build the plugin; scaffold the judged fixture in a directory outside this repository and run `/bdk:triage` in auto mode with `claude -p --plugin-dir`; check the log, the reasons and `report.md`
- [x] 4.2 In the same kind of project in manual mode, run triage with the failing `lavish-axi` stand-in and check that it asks and records nothing invented

## 5. Evals, acceptance and gates

- [x] 5.1 Run the three triage cases with and without the plugin (3 runs per arm); fix the skill or graders until each shows a positive `Δ` and `triage-auto-policy` passes its policy graders with the plugin; record the results in design D9
- [x] 5.2 Check the acceptance signal: `triage-auto-policy` decides by policy and records every decision
- [x] 5.3 Run every CI check (`pnpm check`, `claude plugin validate` of the marketplace and every plugin, the other jobs of `.github/workflows/pr.yml`), `openspec validate v3-195-triage-block --strict` and `openspec validate --specs --strict`

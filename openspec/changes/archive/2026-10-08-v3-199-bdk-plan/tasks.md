# Tasks

## 1. Eval cases first

- [x] 1.1 Write the cases `plan-fresh`, `plan-resume-after-fail`, `plan-budget-spent`, `plan-verify-written` (prompt, `case.yaml`, `scaffold.sh`, graders per design D8)
- [x] 1.2 Run the free check (`pnpm exec vitest run plugins/bdk/tests/evals.test.ts`) and see the cases load

## 2. Skill, with `/skill-creator`

- [x] 2.1 Build `plugins/bdk/skills/plan/SKILL.md` (design D1-D7)
- [x] 2.2 Run `bdk-skill-kit:skill-check` on the skill and fix every finding; `claude plugin validate plugins/bdk --strict`
- [x] 2.3 Add the plan cases, their grants and the run command to `plugins/bdk/evals/README.md`; add the skill to `CLAUDE.md` "Current state"

## 3. Acceptance end to end

- [x] 3.1 Build the plugin; in a separate test project scaffolded from `ledger-change.sh` (outside this repository) run `claude -p "/bdk:plan add-csv-export" --plugin-dir plugins/bdk`; check the parts, `verify-1.md`, the reply (waves, verdict, `/bdk:execute add-csv-export`) and that `git status` shows only the parts and run files
- [x] 3.2 In test projects: a design whose last report fails stops the run naming `/bdk:design` with no block started; a plan whose last report passes starts no block and names `/bdk:execute`
- [x] 3.3 In a test project whose design leaves a product choice open, check `plan-draft` names the gap and the run stops before the verifier
- [x] 3.4 Run the orchestrator cases (`--ablation none`, `--runs 1`, grants per README), fix the skill or graders until every `tool_order` and `file_exists` grader passes, and record the results in a "Results" section of design.md
- [x] 3.5 Run every CI check (`pnpm check`, `claude plugin validate` of the marketplace and every plugin), `openspec validate v3-199-bdk-plan --strict` and `openspec validate --specs --strict`

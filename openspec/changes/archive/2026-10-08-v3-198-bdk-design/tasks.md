# Tasks

## 1. Configuration key `policy.budgets.verifier`

- [x] 1.1 Failing tests first in `plugins/bdk/src/config/tests/`: default 3 with origin `default`, a layer value 0 reported as `policy.budgets.verifier`; see them fail
- [x] 1.2 Add `verifier: count(3)` to `policy.budgets` in `src/config/domain/settings.ts` until the tests pass; tell the other agents (shared config slice)

## 2. Eval cases first

- [x] 2.1 Write the cases `design-fresh-auto-gate`, `design-resume-after-fail`, `design-manual-gate-no-ask` (prompt, `case.yaml`, `scaffold.sh`, graders per design D8)
- [x] 2.2 Run the free check (`pnpm exec vitest run plugins/bdk/tests/evals.test.ts`) and see the cases load

## 3. Skills, each with `/skill-creator`

- [x] 3.1 Build `plugins/bdk/skills/design/SKILL.md` (design D1-D6)
- [x] 3.2 Add the revision request paragraph to `skills/design-draft/SKILL.md` (design D7)
- [x] 3.3 Run `bdk-skill-kit:skill-check` on both skills and fix every finding; `claude plugin validate plugins/bdk --strict`
- [x] 3.4 Add the design cases, their grants and the orchestrator run command to `plugins/bdk/evals/README.md`; add the skill to `CLAUDE.md` "Current state"

## 4. Acceptance end to end

- [x] 4.1 Build the plugin; in a separate test project scaffolded from `ledger-proposal.sh` (outside this repository) run `claude -p "/bdk:design add-csv-export" --plugin-dir plugins/bdk` with `decide-and-record` and an `auto` gate; check the run files, the spec delta, `design.md`, `gate.md`, and that `git status` shows nothing else changed
- [x] 4.2 In a test project with `policy.budgets.verifier: 1` and a design the verifier fails, check the run stops before the gate with the open IDs and no `gate.md`
- [x] 4.3 Run the orchestrator cases (`--ablation none`, `--runs 1`, grants per README), fix the skill or graders until every `tool_order` and `file_exists` grader passes, and record the results in a "Results" section of design.md
- [x] 4.4 Run every CI check (`pnpm check`, `claude plugin validate` of the marketplace and every plugin), `openspec validate v3-198-bdk-design --strict` and `openspec validate --specs --strict`

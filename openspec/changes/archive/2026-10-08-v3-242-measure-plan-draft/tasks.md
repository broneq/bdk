# Tasks

## 1. Case

- [x] 1.1 Write the case `plugins/bdk/evals/plan-draft-household-book/` (design D1) and run the free check `plugins/bdk/tests/evals.test.ts`

## 2. Measurement

- [x] 2.1 Run the case with and without the plugin, 3 runs per arm, `--model sonnet`, `--keep-temp` (design D1)
- [x] 2.2 Measure every run's plan on its kept workspace: `bdk plan check`, scenario ownership, task contracts (design D2 items 1-3)
- [x] 2.3 Run `/bdk:verify-plan` on a copy of every run's workspace with `claude --plugin-dir` outside this repository (design D2 item 4)
- [x] 2.4 Record the results in design "Measurement" and the decision by D3 in design "Decision"

## 3. Decision

- [x] 3.1 Apply the decision: when "change", rewrite the failing step of `plan-draft` with `/skill-creator` and measure the case again; when "remove", open the follow-up issue; when "keep", record it in the case's README paragraph; open the follow-up issue for what was not measured (#253, the gap stop)

## 4. Documentation and gates

- [x] 4.1 Document the case and its run command in `plugins/bdk/evals/README.md`; correct the fixture's scenario count to 71
- [x] 4.2 Run every CI check (`pnpm check`, `claude plugin validate` of the marketplace and every plugin), `openspec validate v3-242-measure-plan-draft --strict` and `openspec validate --specs --strict`

## 1. Eval run environment

- [x] 1.1 Test first: `plugins/bdk/tests/evals.test.ts` expects the environment `run.ts` builds for a run to set `npm_config_update_notifier=false` and keep every other variable and the `runPath` result; run it and see it fail
- [x] 1.2 `plugins/bdk/evals/run.ts`: build the run's environment in an exported `runEnv` and use it; the test of 1.1 passes
- [x] 1.3 `plugins/bdk/evals/README.md` "Host limits": an entry for npm's update check, its sandbox violation and the setting the script passes

## 2. Skills (with /skill-creator)

- [x] 2.1 Eval case first: grader `lavish-own-command` in `design-draft-lavish` and `triage-lavish` (design D3); `pnpm exec vitest run plugins/bdk/tests/evals.test.ts` loads both cases
- [x] 2.2 `design-draft`, `design` and `triage` SKILL.md: each Lavish command a Bash command of its own, without `;`, `&&`, pipes or `echo` (design D2); skill-creator validation passes

## 3. Acceptance and gates

- [x] 3.1 Paid run: `design-draft-lavish` with `--runs 3 --ablation none` on a Mac with the "Host limits" setup scores 1.00 in 3 of 3 runs; the other stub cases (`design-draft-ask`, `triage-lavish`, `triage-ask`, `setup-web-app`) keep their scores (all 1.00, 3 runs each); results in design.md "Measured"
- [x] 3.2 `pnpm docs:reference`, `pnpm check` and every other check of `.github/workflows/`, `openspec validate v3-298-evals-lavish-stub-offline --strict` and `openspec validate --specs --strict` pass

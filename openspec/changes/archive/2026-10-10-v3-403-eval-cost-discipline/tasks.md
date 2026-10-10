# Tasks

## 1. Spec check first

- [x] 1.1 Add a test to `plugins/bdk/tests/evals.test.ts` that reads `plugins/bdk/evals/README.md` and fails unless a "Before a paid run" heading's part names `--runs 1`, `--max-cost-usd` and `--ablation none`; verify it fails on the current README with `pnpm exec vitest run plugins/bdk/tests/evals.test.ts -t "paid run"`.

## 2. Eval README

- [x] 2.1 Add "### Before a paid run" under "## Run" in `plugins/bdk/evals/README.md` with the rules of spec `skill-evals` "Paid measurement discipline" and design D2, D4; verify the test of 1.1 passes.
- [x] 2.2 Add "### Flaky cases" next to "## Host limits" (design D5); verify by reading it against the "Flake accepted by its cause" scenario.
- [x] 2.3 Reword the "Run" commands so the both-arms command is labelled as the admission question and the probe and confirmation commands pass `--ablation none` (scenario "Block case arms follow the question"); verify by reading.

## 3. SDLC and OpenSpec configuration

- [x] 3.1 In `CLAUDE.md` SDLC "Create", name a `Budget` section for an issue that pays for model runs and the check that the question is not already answered; verify `git diff CLAUDE.md`.
- [x] 3.2 In `openspec/config.yaml`, add `Budget` to the issue sections in `context` and a `design` rule that a design reporting a paid measurement records the total cost and machine time of every paid run or names the runs without one; verify `openspec instructions design --change v3-403-eval-cost-discipline --json` lists the rule.

## 4. Checks

- [x] 4.1 Check the Acceptance signal of #403: the README, `CLAUDE.md` and `openspec/config.yaml` hold the rules; no paid run made.
- [x] 4.2 Run `pnpm docs:reference` (no Reference change expected), `pnpm check`, `openspec validate v3-403-eval-cost-discipline --strict` and `openspec validate --specs --strict`; all pass.

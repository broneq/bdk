# Tasks

## 1. Eval case

- [x] 1.1 Add `plugins/bdk/evals/explore-project-facts/` (prompt, case, scaffold planting the test wrapper, the global setup and the hook, graders `map-names-hook`, `map-names-budget-wrapper`, `map-names-global-setup`, `map-written`, `explorer-started`, `skill-fired`); verify: `pnpm exec vitest run plugins/bdk/tests/evals.test.ts` passes and the scaffold's `npm test` passes in a temporary directory

## 2. Skill

- [x] 2.1 Extend step 2 of `plugins/bdk/skills/explore/SKILL.md`: follow the test command to its script and setup files, read the project's rules and docs on build, test and run, name a hook, wrapper or setup step under `Patterns` or `Gaps`; verify: `/bdk-skill-kit:skill-check` on the skill passes

## 3. Measurement and model

- [x] 3.1 Run `explore-csv-export`, `explore-cli-options` and `explore-project-facts` once (`--ablation none --runs 3 --model sonnet`) with the explorer on `haiku`, `sonnet` and `opus`; record scores and cost in design "Measurement"
- [x] 3.1a Fix what the series show in `explore` step 2 (the help command run as written, files read without Bash) and run the three cases once more on the chosen model; record it in design "Measurement"
- [x] 3.2 Set `model:` of `plugins/bdk/agents/explorer.md` to the chosen model and update the spec deltas if it is not `sonnet`; verify: `pnpm test`
- [x] 3.3 Run `explore-model-set` and `design-fresh-auto-gate` once on the chosen default; record result and cost in design "Measurement" and in `plugins/bdk/evals/README.md`

## 4. Docs

- [x] 4.1 Update the explorer's model in `docs/guide/footprint.md`, `docs/concepts/stages.md` (table), `docs/concepts/agents.md` (diagram and table), `docs/concepts/orchestrators.md` (diagram) and `docs/design/2026-10-07-v3-architecture.md`; describe `explore-project-facts` in `plugins/bdk/evals/README.md`
- [x] 4.2 Run `pnpm docs:reference`; verify `docs/reference/bdk/agents.md` names the new model

## 5. Checks

- [x] 5.1 Acceptance: the explore cases pass on the chosen model with the map naming the planted facts (task 3.1 result)
- [x] 5.2 Run `pnpm check`, every other job of `.github/workflows/pr.yml`, `openspec validate v3-410-explorer-sonnet --strict` and `openspec validate --specs --strict`

## 1. Eval cases first

- [x] 1.1 Add an internal line to the proposal of `plugins/bdk/evals/fixtures/tally-cli.sh` (amount parsing in one module) and rewrite the graders of `e2e-check-cli-broken` for paths derived from the proposal (design D8)
- [x] 1.2 Write the case `e2e-check-proposal-paths`: the proposal promises `tally total --json`, no delta mentions it, the product ignores the flag; graders for the finding at the proposal line, a `break` path and at most 5 paths per process
- [x] 1.3 Write the case `e2e-check-no-user-change`: a refactor proposal gives `Verdict: SKIPPED` without running the product; reword the prompt of `e2e-check-no-e2e`
- [x] 1.4 Run the free check `pnpm exec vitest run plugins/bdk/tests/evals.test.ts`, which loads the cases and runs their scaffolds

## 2. Skill and agent

- [x] 2.1 Rewrite `plugins/bdk/skills/e2e-check/SKILL.md` with /skill-creator: proposal processes, paths (`main`, variants, `break`, at most 5 per process), expected values from design and deltas, baseline for break paths, `<process>--<path>` evidence, verdict sections, finding at the proposal line, skip reasons, reply (design D1-D6)
- [x] 2.2 Rename scenario to path in `references/drivers.md` (script, screenshot and video names)
- [x] 2.3 Update the description of `plugins/bdk/agents/e2e-tester.md`
- [x] 2.4 `plugins/bdk/skills/spec-conformance/SKILL.md`: a failed E2E path is `Must address`, naming the proposal line (design D7)
- [x] 2.5 Rewrite the modelled E2E evidence of `fixtures/tally-reviewed.sh` and `spec-conformance-conforming/scaffold.sh` into path files
- [x] 2.6 Run the `e2e-check-*` eval cases (`--runs 1`, both arms), fix skill or graders until they pass, record the results under "Measurements" in design.md; update `plugins/bdk/evals/README.md`

## 3. Docs

- [x] 3.1 `docs/concepts/e2e.md`: what the tester derives from the proposal, processes and paths, evidence names, skip reasons, the diagram
- [x] 3.2 `docs/concepts/run-state.md`, `stages.md`, `findings.md`, `agents.md`, `openspec-changes.md`; `docs/guide/index.md`, `workflow.md`, `configuration.md`
- [x] 3.3 `pnpm docs:reference`

## 4. Acceptance and gates

- [x] 4.1 Check the Acceptance signal: the eval runs show paths derived from the proposal, grouped by process, at most 5 per process, each traced to a proposal line, and `SKIPPED` for a proposal without a user-visible change
- [x] 4.2 Run every check CI runs (`pnpm check`, the other jobs of `.github/workflows/pr.yml`), `openspec validate v3-321-live-e2e-from-proposal --strict` and `openspec validate --specs --strict`

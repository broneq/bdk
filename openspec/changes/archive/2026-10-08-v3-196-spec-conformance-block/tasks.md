## 1. Eval cases first

- [x] 1.1 Write the shared fixture `plugins/bdk/evals/fixtures/tally-change.sh` (design D6): `tally add` on `main` with the main spec `tally` (`Add`, `Usage`), and the branch `add-total` with the Change `add-total` (ADDED `Total` with two scenarios, MODIFIED `Usage`) and conforming code
- [x] 1.2 Write the cases `spec-conformance-contradicted`, `spec-conformance-undocumented` and `spec-conformance-conforming` with their scaffolds and graders (design D6)
- [x] 1.3 Run the free check `pnpm exec vitest run plugins/bdk/tests/evals.test.ts`: the cases load and the scaffolds run; confirm in a scaffolded copy that each case's code holds the defect it names

## 2. The block

- [x] 2.1 Check that the `bdk:verifier` agent of #191 serves the block unchanged (its description names `bdk:spec-conformance`; design D1), and name the block in `CLAUDE.md` "Current state"
- [x] 2.2 Build `plugins/bdk/skills/spec-conformance/SKILL.md` with `/skill-creator` (design D1-D4): `!` config block, hand-off to `bdk:verifier`, input and base, reading, the six checks, sorting, the report file with stable IDs and replacement, the reply
- [x] 2.3 Run `bdk-skill-kit:skill-check` on the skill and the agent and fix every finding; `claude plugin validate plugins/bdk --strict` passes
- [x] 2.4 Add the cases, their grants and run command to `plugins/bdk/evals/README.md`

## 3. Acceptance end to end

- [x] 3.1 Build the plugin; in a test project scaffolded from the `spec-conformance-contradicted` scaffold outside this repository, run `claude -p --plugin-dir plugins/bdk` asking to check that the specs of `add-total` describe the product before archiving; check `close/spec-conformance.md` starts with `Verdict: FAIL`, names the empty-ledger scenario under `Must address` with a `bin/tally.js` line, the agent `bdk:verifier` wrote it, and `git status` is clean
- [x] 3.2 Same for the undocumented and the conforming projects; then rerun the contradicted project after fixing the code and check `Closed: M1` and `Verdict: PASS`; check `bdk run status` reads the passing report; and a project whose E2E file fails a scenario the code holds, and one without `.bdk/settings.yaml`
- [x] 3.3 Run the eval cases with and without the plugin, fix the skill or graders until they pass, record scores, time, cost and host problems under "Measurements" in design.md

## 4. Gates

- [x] 4.1 Run every CI check (`pnpm check`, `claude plugin validate` of the marketplace and every plugin, the rest of `.github/workflows/`), `openspec validate v3-196-spec-conformance-block --strict` and `openspec validate --specs --strict`

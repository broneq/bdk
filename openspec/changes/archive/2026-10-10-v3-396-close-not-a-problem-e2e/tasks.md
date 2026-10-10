# Tasks

## 1. Eval cases first

- [x] 1.1 Write the shared fixture `plugins/bdk/evals/fixtures/tally-e2e-cleared.sh` (design D4) and check it builds in a temp directory
- [x] 1.2 Write the block case `plugins/bdk/evals/spec-conformance-e2e-cleared/` (cleared `empty-ledger`, deferred `blocker` `boolean-entry`)
- [x] 1.3 Write the orchestrator case `plugins/bdk/evals/close-e2e-cleared/` (close archives and opens the PR; the body names the cleared path)
- [x] 1.4 Run both cases against the current skills (`--ablation none`, 1 run each) and record that they fail before the change (both 0.83, 3 runs: see design D4)

## 2. Skills (with /skill-creator)

- [x] 2.1 `plugins/bdk/skills/spec-conformance/SKILL.md`: step 2 reads the round's log for a round verdict; problem 2 excludes a cleared path; step 4 `Checked` names it with the finding id and reason
- [x] 2.2 `plugins/bdk/skills/close/SKILL.md` step 7: a `FAIL` E2E verdict carries the cleared paths of the spec-conformance report's `E2E:` line
- [x] 2.3 Run `skill-check` on both skills

## 3. Measure

- [x] 3.1 Run `spec-conformance-e2e-cleared`, `close-e2e-cleared` and the existing `spec-conformance-*` and `close-*` cases with the plugin; record results in `plugins/bdk/evals/README.md`
- [x] 3.2 Try `/bdk:close` on the fixture in a separate test project started with `claude --plugin-dir` (the eval runs of 3.1: each run is its own workspace with the plugin loaded from `plugins/bdk`)

## 4. Docs

- [x] 4.1 `docs/concepts/findings.md` (the `blocker` row), `docs/concepts/openspec-changes.md` (close's spec check), `docs/concepts/stages.md` (the spec check row of close), `docs/concepts/e2e.md` (who reads the verdict); no diagram draws the E2E items of the spec check, none is redrawn
- [x] 4.2 `plugins/bdk/evals/README.md`: the two cases and their fixture, next to `judge-e2e-failure` (the E2E ground of #391)
- [x] 4.3 `pnpm docs:reference`

## 5. Gates

- [x] 5.1 Acceptance signal: `close-e2e-cleared` ends with close passing
- [x] 5.2 Every check CI runs (`.github/workflows/`), incl. `pnpm check`
- [x] 5.3 `openspec validate v3-396-close-not-a-problem-e2e --strict` and `openspec validate --specs --strict`

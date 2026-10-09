## 1. Eval fixture and cases first

- [x] 1.1 Write the shared fixture `plugins/bdk/evals/fixtures/tally-ledger-path.sh` (D8) on top of `tally-change.sh`; verify by running it in a temporary directory: `tally add abc` prints `tally: not an amount: abc` and exits 1, and `TALLY_LEDGER=/tmp/x.json tally add 5` writes under the current directory.
- [x] 1.2 Write the eval case `spec-conformance-round` (scaffold: fixture plus an empty round-1 log; graders: report in the round, both findings of source `spec-conformance` in the log, no `close/spec-conformance.md`, verifier started, skill fired); verify it is red against the current skill with one with-plugin run (no round mode yet).
- [x] 1.3 Write the eval case `judge-spec-conformance` (scaffold: both findings unleveled in round 1; graders: both `blocker`); verify with one with-plugin run against the current judge.
- [x] 1.4 Write the eval case `plan-fixes-spec-delta` (scaffold: both findings leveled `blocker` and decided `fix`; graders: a fix part with the delta in `files`, `index.md` with `- None.` under `## Not planned`); verify with one with-plugin run against the current `plan-fixes`.
- [x] 1.5 Add graders to `auto-review-first-round`: `verifier-in-round` (the lead starts `bdk:verifier` with `--round` and `run_in_background: false`), `conformance-written` (`round-1/spec-conformance.md` exists), and the verifier in `workers-foreground`.
- [x] 1.6 The free check `pnpm exec vitest run plugins/bdk/tests/evals.test.ts` passes with the new cases.

## 2. Skills and agent (with /skill-creator)

- [x] 2.1 `spec-conformance`: `--round` mode (report path, no E2E, `bdk findings add` placed where the fix goes, reply), and step 3 checks each SHALL sentence for every input class it names; verify with `spec-conformance-round` and the existing `spec-conformance-*` cases.
- [x] 2.2 `agents/verifier.md`: the `bdk findings add` exception; verify with `spec-conformance-round` (no denied call) and `bdk-skill-kit:skill-check`.
- [x] 2.3 `review-round`: the verifier in step 3, in every round, with `models.verifier`; `round.md` `## Spec conformance`; description; verify with `auto-review-first-round`.
- [x] 2.4 `judge`: the `blocker` row and the two-sided check for `spec-conformance`; verify with `judge-spec-conformance` and `judge-levels`.
- [x] 2.5 `plan-fixes`: plannable spec-delta fixes and the narrower not-plannable rule; verify with `plan-fixes-spec-delta` and `plan-fixes-judged-round`.
- [x] 2.6 Write the cases `implement-part-spec-delta` and `conform-part-spec-delta` (fixture `tally-spec-fix-part.sh`) for a fix part that changes spec text only; run them against the unchanged `implement-part` and `conform-part`, and change those skills only if a case fails (both passed: no change).
- [x] 2.7 Try the round in a separate test project started with `claude --plugin-dir plugins/bdk` (the eval runs are such projects) and record the eval results in `plugins/bdk/evals/README.md`.

## 3. Docs

- [x] 3.1 `docs/concepts/orchestrators.md`: redraw the `/bdk:review-round` sequence diagram with the verifier in the first parallel step, and the prose.
- [x] 3.2 `docs/concepts/stages.md` (review table and close row), `docs/concepts/agents.md` (the round's workers diagram and the `/bdk:spec-conformance` row), `docs/concepts/findings.md` (the `found` node of its diagram and the sources table), `docs/concepts/run-state.md` (round files table, the writers diagram), `docs/concepts/openspec-changes.md`, `docs/guide/workflow.md`, `docs/guide/footprint.md` (the `policy.budgets.review-rounds` row), `docs/concepts/cli-config-hooks.md` (the `/bdk:auto-review` node).
- [x] 3.3 `pnpm docs:reference`; verify `pnpm check` reports no stale Reference page.

## 4. Acceptance and gates

- [x] 4.1 Acceptance signal: `spec-conformance-round` finds both defects in the round log with the plugin; `judge-spec-conformance` levels both `blocker`; `plan-fixes-spec-delta` plans both. The B1-sized run goes to a follow-up issue (design, Risks).
- [x] 4.2 Every check CI runs (`.github/workflows/`): `pnpm check` and the other jobs; `openspec validate v3-265-spec-conformance-in-review --strict` and `openspec validate --specs --strict`.

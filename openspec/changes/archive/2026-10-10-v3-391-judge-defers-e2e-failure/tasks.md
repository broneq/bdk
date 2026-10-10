## 1. Eval case first

- [x] 1.1 Write the shared fixture `plugins/bdk/evals/fixtures/tally-broken-ledger.sh` and the eval case `plugins/bdk/evals/judge-e2e-failure/` (D4): round 1 with the E2E verdict, two failed `break` path files and two unleveled `e2e-check` findings; graders: both findings `blocker`, `review.md` exists, no `Edit`, no denied call, skill fired.
- [x] 1.2 Run the scaffold in a temporary directory: `tally total` on `["abc"]` crashes with a `TypeError` stack trace (exit 1), on `[true, 5]` prints `Total: 6.00` (exit 0), on `{` prints `tally: cannot read ledger.json` (exit 2); `npm test` and `openspec validate add-total --strict` pass; the log holds two unleveled findings.
- [x] 1.3 Run the case with the plugin against the current judge and record the result.

## 2. Skill (with /skill-creator)

- [x] 2.1 `plugins/bdk/skills/judge/SKILL.md`: the `blocker` row, the `e2e-check` rule of D1-D3, and step 2 reads the path file of an `e2e-check` finding.
- [x] 2.2 Run `judge-e2e-failure` 3 times with the plugin and the other `judge-*` cases once each as regression cover; record the results in `plugins/bdk/evals/README.md`.

## 3. Docs

- [x] 3.1 `docs/concepts/findings.md` (Levels table) and `docs/concepts/stages.md` (the review stage's level summary); no diagram draws the levels, none is redrawn.
- [x] 3.2 `pnpm docs:reference`; verify `pnpm check` reports no stale Reference page.

## 4. Acceptance and gates

- [x] 4.1 Acceptance signal: `judge-e2e-failure` levels both `e2e-check` findings `blocker` in 3 of 3 runs.
- [x] 4.2 File the known gap of D3 as its own issue.
- [x] 4.3 Every check CI runs (`.github/workflows/`), `openspec validate v3-391-judge-defers-e2e-failure --strict` and `openspec validate --specs --strict`.

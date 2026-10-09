## 1. Eval cases

- [x] 1.1 Add the shared fixture `plugins/bdk/evals/fixtures/tally-total-untested.sh`: `tally-change.sh` with the BDK schema, plan part 01 of `add-total`, a test of "Total of added amounts" only, and review round 1 judged and triaged (one `should-fix` finding "scenario Empty ledger has no test", decided `fix`)
- [x] 1.2 Add the block case `plugins/bdk/evals/plan-fixes-present-behaviour/` (part 02 marks `Empty ledger` ` (behaviour present)`, no task on `bin/tally.js`) and run it against the current skill to see it fail
- [x] 1.3 Add the block case `plugins/bdk/evals/implement-part-present-behaviour/` (fix part 02 written with the marker; `Status: done`, the green-at-first-run line) and run it against the current skill to see it fail
- [x] 1.4 Add the orchestrator case `plugins/bdk/evals/auto-review-present-behaviour/` (the acceptance signal: part 02 done and committed, the green-at-first-run line)
- [x] 1.5 Name the fixture and the cases with their commands in `plugins/bdk/evals/README.md`

## 2. Skills (with /skill-creator)

- [x] 2.1 `skills/plan-fixes/SKILL.md`: step 2 decides whether a "no test" finding's behaviour is present; step 4 writes the ` (behaviour present)` marker and the `Verified by:` wording
- [x] 2.2 `skills/implement-part/SKILL.md`: step 4 expects a marked scenario's test green and makes each disagreement a `plan-defect`; step 7 the report line `; green at first run (behaviour present); green seen`
- [x] 2.3 Run the three new cases and `implement-part-csv`, `plan-fixes-judged-round` against the new skills and record the results in `plugins/bdk/evals/README.md`

## 3. Docs

- [x] 3.1 `docs/concepts/stages.md` (implement-part: a test of present behaviour) and `docs/concepts/findings.md` (a "no test" finding becomes a marked fix part); the implement-part diagram in `docs/concepts/orchestrators.md` (a marked scenario is green at its first run)
- [x] 3.2 Run `pnpm docs:reference`

## 4. Gates

- [x] 4.1 Check the acceptance signal: `auto-review-present-behaviour` passes with the plugin
- [x] 4.2 `pnpm check`, every check in `.github/workflows/`, `openspec validate v3-346-fix-part-test-only-red --strict` and `openspec validate --specs --strict`

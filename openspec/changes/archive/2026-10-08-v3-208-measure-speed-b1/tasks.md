# Tasks

## 1. Queued state

- [x] 1.1 Write `plugins/bdk/evals/fixtures/household-book-queued.sh` (design D2); run it in an empty directory and check `bdk run status`, `git status` and `bdk config show` there
- [x] 1.2 Add the free check of the queued state to `plugins/bdk/tests/household-book.test.ts` and run it with `evals.test.ts`

## 2. Measurement

- [x] 2.1 Build the plugin; build the queued workspace outside this repository; run `claude -p "/bdk:run"` there as design D3 says, resuming after a stop
- [x] 2.2 Read stage, wave, part, round, turn, agent and cost numbers from the stream, the transcripts and the run files (design D3)
- [x] 2.3 Record the report in design "Measurement": execute and plan-to-PR time against the targets and B1 (design D4)
- [x] 2.4 Open an issue for each concrete slowness the run shows (design D5) and name them in the report
- [x] 2.5 Correct the fixture where run 1 showed it wrong, re-run `verify-design` and `verify-plan` on it, replace the records, and run the plan-to-PR again (design D6)

## 3. Documentation and gates

- [x] 3.1 Document the queued state, its run command and the recorded result in `plugins/bdk/evals/README.md`
- [x] 3.2 Run every CI check (`pnpm check`, `claude plugin validate` of the marketplace and every plugin), `openspec validate v3-208-measure-speed-b1 --strict` and `openspec validate --specs --strict`

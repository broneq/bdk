# Tasks

## 1. Uncorrected state

- [x] 1.1 Write the free check of the uncorrected state in `plugins/bdk/tests/household-book.test.ts`
- [x] 1.2 Write `plugins/bdk/evals/fixtures/household-book/uncorrected.patch` (the reverse of #208 design D6 on the workspace paths) and `household-book-uncorrected.sh` (design D1); run the check

## 2. Measurement

- [x] 2.1 Build the plugin; build the uncorrected workspace outside this repository; run `claude -p "/bdk:run"` there as design D2 says, resuming after a stop
- [x] 2.2 Read from the stream, the transcripts and the run files what design D3 lists
- [x] 2.3 Record the report in design "Measurement"
- [x] 2.4 Open an issue for each product defect the run shows (design D4) and name it in the report

## 3. Documentation and gates

- [x] 3.1 Document the uncorrected state, its run command and the recorded result in `plugins/bdk/evals/README.md`
- [x] 3.2 Check the acceptance signal against the report; run every CI check (`pnpm check`, `claude plugin validate` of the marketplace and every plugin), `pnpm docs:reference`, `openspec validate v3-368-measure-spec-conformance-run --strict` and `openspec validate --specs --strict`

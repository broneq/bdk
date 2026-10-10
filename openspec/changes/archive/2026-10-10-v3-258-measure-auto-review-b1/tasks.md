# Tasks

## 1. Build

- [x] 1.1 Build the plugin; build the queued workspace outside this repository and run `claude -p "/bdk:execute add-household-book"` there (design D1, D4); keep the built workspace as the source of every review run

## 2. Measurement

- [x] 2.1 Run A: copy the build, run `claude -p "/bdk:auto-review add-household-book"` (design D2)
- [x] 2.2 Judge every finding of run A real or false; audit the built product by hand against its spec scenarios for missed defects (design D2)
- [x] 2.3 Run B: copy the build, commit the seeds (design D3), run `/bdk:auto-review`; record which seeds each round logs and at what level
- [x] 2.4 Read per-round wall time, workers, findings, decisions, fix parts, fix pass, cost and the main thread's context from the streams, transcripts and run files (design D4)
- [x] 2.5 Record the report in design "Measurement", compared with #266 and the B1 baseline
- [x] 2.6 Open an issue for each missed seed class, false-finding pattern and concrete slowness (design D5) and name them in the report

## 3. Gates

- [x] 3.1 Run every CI check (`pnpm check`, `claude plugin validate` of the marketplace and every plugin, `pnpm docs:reference` with no diff), `openspec validate v3-258-measure-auto-review-b1 --strict` and `openspec validate --specs --strict`

# Tasks

## 1. Workspace

- [x] 1.1 Build the plugin; build the queue workspace outside this repository (design D1, D4) and keep a pristine copy for the solo run

## 2. Measurement

- [x] 2.1 Session 1: `claude -p "/bdk:run #1 #2 #3 #4"`; record each stop and its cause, resume with `/bdk:run` when a stop is not the queue's end (design D4)
- [x] 2.2 Merge Change 3's pull request as a user would and run `claude -p "/bdk:run"` again (design D2)
- [x] 2.3 Solo run: `claude -p "/bdk:run #3"` in a fresh copy of the workspace (design D3)
- [x] 2.4 Read per Change turns, time, cost, compactions, stops, context and stage times; per session Changes finished; early stops (design D4)
- [x] 2.5 Check each Change's quality: verify and review rounds, findings, close verdict, `npm test`, the product by hand (design D3)
- [x] 2.6 Record the report and the decisions on the hook engine, parking and one session per Change in design "Measurement" and "Decisions from the measurement"
- [x] 2.7 Open an issue for each defect found and each piece of work a decision calls for (design D5) and name them in the report

## 3. Gates

- [x] 3.1 Run every CI check (`pnpm check`, `claude plugin validate` of the marketplace and every plugin, `pnpm docs:reference` with no diff), `openspec validate v3-260-measure-run-multi-change-queue --strict` and `openspec validate --specs --strict`

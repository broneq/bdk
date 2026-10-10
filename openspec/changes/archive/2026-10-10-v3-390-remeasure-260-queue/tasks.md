# Tasks

## 1. Workspace

- [x] 1.1 Build the plugin; build the queue workspace outside this repository as #260 D1 and D4 do (design D1, D3)

## 2. Measurement

- [x] 2.1 Session 1: `claude -p "/bdk:run #1 #2 #3 #4"`; resume with `/bdk:run` after any stop that is not the queue's end and record its cause (design D2)
- [x] 2.2 Merge Change 3's pull request as a user would and run `claude -p "/bdk:run"` again (design D2)
- [x] 2.3 Per Change: execute's outcome, scenarios listed and marked present, the implementer's first test run against each mark; per session time, cost and end (design D4)
- [x] 2.4 Record the report in design "Measurement" and compare it with #260
- [x] 2.5 Open an issue for each defect found outside this task and name it in the report

## 3. Gates

- [x] 3.1 Run every CI check (`pnpm check`, `claude plugin validate` of the marketplace and every plugin, `pnpm docs:reference` with no diff), `openspec validate v3-390-remeasure-260-queue --strict` and `openspec validate --specs --strict`

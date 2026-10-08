# Tasks

## 1. Ready-to-plan state

- [x] 1.1 Write `plugins/bdk/evals/fixtures/household-book.sh`: the base project `ledger` (code, tests, main spec, README), `.bdk/settings.yaml`, the BDK schema, `.gitignore`, one commit (design D1, D4)
- [x] 1.2 Write the Change `add-household-book` under `fixtures/household-book/change/`: proposal, spec deltas, design (design D1)
- [x] 1.3 Write the design approval records under `fixtures/household-book/runs/design/` and copy them in (design D5); run the script in an empty directory, check `npm test` and `openspec validate add-household-book`

## 2. Planned state

- [x] 2.1 Write the 7 plan parts under `fixtures/household-book/change/plan/parts/` (design D2)
- [x] 2.2 Write `plugins/bdk/evals/fixtures/household-book-planned.sh` on top of the ready state (design D3); run it and `bdk plan check` there

## 3. Checks

- [x] 3.1 Write `plugins/bdk/tests/household-book.test.ts` (design D6) and run it with `evals.test.ts`
- [x] 3.2 Write the case `plugins/bdk/evals/verify-plan-household-book/` (design D7)
- [x] 3.3 Probe: build the plugin, run the case one arm with `--runs 1`; fix the Change until the verifier passes; record its report as `runs/plan/verify-1.md` and the result in design "Probe run"

## 4. Documentation and gates

- [x] 4.1 Document both states and the manual runs in `plugins/bdk/evals/README.md`
- [x] 4.2 Run every CI check (`pnpm check`, `claude plugin validate` of the marketplace and every plugin), `openspec validate v3-243-b1-eval-fixture --strict` and `openspec validate --specs --strict`

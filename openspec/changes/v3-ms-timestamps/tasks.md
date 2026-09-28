# Tasks

## 1. Reproduce

- [x] 1.1 Write a failing E2E test in `kernel/src/log/tests/log.e2e.ts`: two `log add` calls in one second, then `log list` must list them in write order with distinct `at` values; run it until it fails on the random id order (repeat the pair in a loop within the test so the tie is certain); verify it fails on the current bundle

## 2. Clock and schema

- [x] 2.1 Write failing unit tests for `shared/clock`: `systemClock` and `fixedClock` give the fixed-width millisecond form; `fixedClock` keeps the milliseconds of its input; implement; verify they pass
- [x] 2.2 Write failing unit tests for `timestamp` in `shared/store/state/common.ts`: both forms accepted, the second form normalised to `.000`, other precisions and offsets refused, a written document holds the normalised form; implement with a zod transform; verify unit tests and `pnpm build` regenerate `schema/state/`
- [x] 2.3 Write failing unit tests for the entry file name: `entryPath` keeps the second, the registry check accepts a millisecond `at` whose second matches the name and refuses another second; implement in `ledger.ts` and `registry.ts`; verify they pass

## 3. Gate and index

- [x] 3.1 Write a failing unit test for the gate scenario `transition of the ready second` (ready at `.800`, transition at the second form); implement truncation to the second in `graph/domain/gate.ts`; verify the gate tests pass
- [x] 3.2 Bump `INDEX_SCHEMA_VERSION` to 4 with a failing test that an index of version 3 is dropped and rebuilt with normalised times; verify the index tests pass

## 4. Contract and docs

- [x] 4.1 Update the hand-written output schema examples to the millisecond form and the `kernel-cli` Conventions scenario test; sync the main specs (`kernel-cli`, `kernel-state`, `kernel-pipeline`) from the deltas; verify `pnpm test:contract` and `openspec validate --specs --strict` pass
- [ ] 4.2 Update the comments that explain second precision (`shared/clock`, `derived.ts`, `attempt/domain/ladder.ts`) and any README or `docs/guide` text naming the time format; verify `pnpm docs:build` passes

## 5. Acceptance

- [ ] 5.1 Verify 1.1 now passes, then run `pnpm lint && pnpm format:check && pnpm typecheck && pnpm knip`, `pnpm test:unit`, `pnpm test:e2e`, `pnpm test:contract`, `pnpm test:perf`, `pnpm docs:build` and `openspec validate v3-ms-timestamps --strict`; verify all pass

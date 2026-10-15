## 1. Reproduce

- [x] 1.1 Time the household-book `afterAll` delete alone, in one full `pnpm test` and in three concurrent full runs with `--maxWorkers=24`, with its CPU time
- [x] 1.2 Time every `rmSync` of the suite under the same load to find the other hooks with the same risk

## 2. Fix

- [x] 2.1 Set `hookTimeout` to the `testTimeout` value in `vitest.config.ts`, with a comment naming the measured cause

## 3. Verify

- [x] 3.1 Acceptance signal: three full `pnpm test` runs in a row, each with two concurrent full runs at `--maxWorkers=24`, pass with no hook timeout
- [x] 3.2 Run every check CI runs (`pnpm check`, `pnpm docs:reference` with no diff, the docs build), `openspec validate v3-417-hook-timeout-under-load --strict` and `openspec validate --specs --strict`

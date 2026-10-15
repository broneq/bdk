## Why

Tracks #417.

A full `pnpm test` on a loaded machine failed `plugins/bdk/tests/household-book.test.ts` with `Hook timed out in 10000ms` in its `afterAll`, which only deletes the scratch root of five built fixtures. Measured under load (design, Context), the delete is about 90% wait on the filesystem, and its wall time follows what the rest of the suite and the machine are doing at that moment, not the size of the tree: 206 entries of `scripts/publish-plugin.test.ts` took 4.7 s, 607 entries of an `evals.test.ts` scaffold 5.9 s, 1521 of household-book 3.1-3.8 s. Every after-hook that deletes a git fixture pays the same stall. `vitest.config.ts` gives tests 30 s because CLI tests spawn processes under load, but leaves hooks, which do the same file and process work, at vitest's 10 s default.

## What Changes

- `vitest.config.ts` sets `hookTimeout` to the `testTimeout` value, so every `beforeAll`/`beforeEach`/`afterAll`/`afterEach`/`onTestFinished` of the workspace suite has the budget a test has.
- `household-book.test.ts` keeps its `afterAll` as it is: its tree is fixed (five fixtures) and does not grow with cases, so the per-test delete of #336 does not apply, and the measured cost is the shared stall, not its size.
- `repo-sdlc` gains the requirement that hooks get the same time budget as tests.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `repo-sdlc`: the workspace test suite gives its hooks the time budget of its tests.

## Impact

- `vitest.config.ts` only; no test file changes.
- Nothing a BDK user sees changes: test infrastructure only, so no docs pages and no Docs task group.
- Out of scope: making fixtures smaller (they are eval inputs, design D3 of `v3-336-evals-test-cleanup-timeout`).

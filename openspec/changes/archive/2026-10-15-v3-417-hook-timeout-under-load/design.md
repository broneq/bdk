# Design

## Context

`household-book.test.ts` builds five fixtures (each a git repository) in `beforeAll` (limit `5 * BUILD_LIMIT_MS`) and deletes their scratch root in `afterAll` with `rmSync`, under vitest's default 10 s `hookTimeout`. `vitest.config.ts` sets only `testTimeout: 30_000`.

Measured on the reporting Mac (12 cores, Node 24, an endpoint security agent authorising file operations), with the delete timed inside the hook:

| Setting | household-book tree | Delete wall | Delete CPU |
|---|---|---|---|
| File alone | 1521 entries, 1179 under `.git/`, 3.7 MB | 335 ms | - |
| One full `pnpm test` | same | 917 ms | - |
| Three concurrent full runs, `--maxWorkers=24` (3 trials) | same | 2.9-3.8 s | 0.3 s |
| Same tree copied, deleted by a standalone script under two concurrent runs | same | 0.3-1.8 s | 0.1-0.3 s |

A probe that timed every `rmSync` of the suite under three concurrent full runs showed the same stall in every file that deletes a fixture, unrelated to tree size:

| File | Entries | Worst delete |
|---|---|---|
| `scripts/publish-plugin.test.ts` (`afterEach`) | 206 | 4.7-5.1 s |
| `plugins/bdk/tests/evals.test.ts` (`onTestFinished`, after #336) | at most 607 | 5.9 s |
| `plugins/bdk/tests/household-book.test.ts` (`afterAll`) | 1521 | 3.8 s |
| `git.test.ts`, `cli.test.ts`, `check.test.ts`, `diagnostics-cli.test.ts` | small | 1.5-2.3 s |

The issue's failure reproduces with five concurrent full runs at `--maxWorkers=24` and the old limit (`--hookTimeout=10000`): all five fail `household-book.test.ts:110` with `Hook timed out in 10000ms`, the only hook that fails. The same load with this Change: no hook timeout in any of the five runs. At that load (120 workers on 12 cores) two tests also exceed their own 30 s (`tests/conflict-markers.test.ts`, `tests/eval-suites.test.ts`); that is past the suite's test budget, not a hook problem.

So the cause is not this hook's work: CPU stays at 0.3 s while wall time grows tenfold; the delete waits on the filesystem, and the wait depends on how much file work the rest of the suite and the machine do at that moment (a 206-entry tree waits longer than a 1521-entry one). The issue's failure was the same stall past 10 s on a machine also running Claude sessions and eval runs. The suite already sized its test budget for exactly this load ("CLI tests spawn Node processes"), but its hooks, which build and delete the same kind of git fixtures, kept the default third of it.

## Goals / Non-Goals

**Goals:**
- No hook of the suite fails on a filesystem stall that a test doing the same work survives.
- One rule for every test file, including those written later.

**Non-Goals:**
- Making fixtures smaller: they are eval inputs and must match what the harness builds (design D3 of `v3-336-evals-test-cleanup-timeout`).
- Raising `testTimeout`.

## Decisions

### D1: `hookTimeout` equals `testTimeout` in `vitest.config.ts`

The config sets `hookTimeout` to the same constant as `testTimeout` (30 s). It is the budget the suite already chose for process and file work under load; hooks do that same work. The measured worst delete (5.9 s) leaves a fivefold margin, the same margin tests have.

Alternatives:
- **`afterAll(fn, 5 * BUILD_LIMIT_MS)` in household-book only** (the issue's second suggestion): fixes one file, while the probe shows `publish-plugin.test.ts` and `evals.test.ts` at 5-6 s under the same load, one step from the same failure. Rejected: the cause is suite-wide.
- **Per-fixture deletes as #336 did**: the five fixtures are shared across describes (the gap case compares with the ready state, queued with planned, uncorrected with queued), and the probe shows a 206-entry tree stalling longer than this 1521-entry one, so splitting the delete would not bound its time. Rejected.
- **Async `fs.promises.rm`**: about 3x faster standalone under load, but still waits on the same stall with no bound. Rejected as the fix; it does not change what fails.
- **Delete in a detached process after the hook returns, or in a global teardown**: takes the delete off any clock, but leaves processes running after vitest exits, or moves the delete under `teardownTimeout` (also 10 s). Rejected: more machinery for the same stall.
- **No limit on hooks (`hookTimeout: 0`)**: a hung hook would hang the suite. Rejected.

### D2: Hooks needing more keep their own limit

`household-book.test.ts`'s `beforeAll` keeps `5 * BUILD_LIMIT_MS`: a per-hook limit overrides the config, so hooks sized for their work stay as they are.

## Risks / Trade-offs

- [A genuinely hung hook now takes 30 s instead of 10 s to fail] -> The same as a hung test today.
- [A stall above 30 s still fails] -> Then tests of the same work fail too; the suite's load budget is the single place to change.

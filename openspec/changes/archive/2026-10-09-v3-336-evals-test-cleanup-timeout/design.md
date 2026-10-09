# Design

## Context

Both free checks share a helper `fresh(name)` that makes a directory under one per-file scratch root (`mkdtempSync` in `beforeAll`); scaffolds, fixture workspaces, launcher fixtures and the planted plugin copy all live there. The only delete was `rmSync(scratch, { recursive: true, force: true })` in `afterAll`, which runs under vitest's `hookTimeout` (10 s by default; `vitest.config.ts` sets only `testTimeout`).

Measured on the reporting Mac (12 cores), with the delete timed inside the hook:

| Run | File | Entries | Delete under full `pnpm test` |
|---|---|---|---|
| unloaded copy | `evals.test.ts` tree | 6.4k | 1.5 s (`rmSync`), 2.3 s (`rm -rf`) |
| 4 full runs | `evals.test.ts` | 6.3-6.4k | 1.9-5.3 s |
| 4 full runs | `eval-suites.test.ts` | 18.4k, 45 MB | 3.6-15.2 s |

Two of the four full runs failed with `Hook timed out in 10000ms`. About 70% of the files are under `.git/` (loose objects, the 14 sample hooks of every `git init`). The cost is per entry (0.25 ms unloaded, up to 0.8 ms under load), so it grows linearly with the number of cases, and every new case scaffold brings it closer to the limit.

## Goals / Non-Goals

**Goals:**
- No hook of the free checks does work that grows with the number of cases.
- The scaffolds still run exactly as the harness runs them (same script, environment and empty workspace).

**Non-Goals:**
- Making scaffolds smaller (e.g. `git init --template=`): scaffolds are eval inputs and must match what the harness builds.
- Changing vitest's global `hookTimeout`.

## Decisions

### D1: Delete each workspace when its test finishes

`fresh()` registers `onTestFinished(() => rmSync(dir, ...))` for the directory it makes. The delete runs after the test, on pass or fail, and covers only that test's tree: at most 607 entries, 776 ms under a full run (567 deletes measured over three full runs). The `afterAll` stays and removes the empty root, and anything a test left outside `fresh()`.

Alternatives:
- **`afterAll(fn, SCAFFOLD_LIMIT_MS)`** (the issue's first suggestion): one line, but the hook's work still grows with every case and the run still pays a 5-15 s stall at the end of each file; it only moves the limit. Rejected: the measurement shows the cause is accumulation, not a too-tight limit.
- **Async `fs.promises.rm` in `afterAll`**: 40% faster unloaded, still unbounded and still on the hook clock. Rejected for the same reason.
- **Leave the scratch tree to the OS temp cleaner**: leaks 60 MB per run on developer machines. Rejected.
- **Delete inside `scaffold()` right after the spawn**: the fixture tests read the workspace after `scaffold()` returns (`readdirSync`, `bdk plan check`), so the delete must wait for the test's end, which `onTestFinished` gives.

### D2: Keep the default hook timeout for the per-test delete

`onTestFinished` takes a timeout; the measured worst case is 13x under the 10 s default, so none is passed. A scaffold that grows to need more than 10 s to delete is itself a problem the check should surface rather than hide.

### D3: Other tests stay as they are

`cli.test.ts`, `check.test.ts`, `diagnostics-cli.test.ts`, `findings-cli.test.ts` and `architecture-lint.test.ts` also delete a temporary tree in an after-hook, but they build a handful of small project directories whose count does not follow the eval suites. Only the two free checks build one git repository per case.

## Risks / Trade-offs

- [A failing scaffold test deletes its workspace, so it cannot be inspected afterwards] → This was already true (the end-of-file delete removed it); rerun the scaffold by hand to inspect it.
- [`fresh()` now must be called inside a test, since `onTestFinished` throws elsewhere] → Every caller already is; a misuse fails loudly at once.

# Proposal

## Why

Tracks #336. A full `pnpm test` run fails now and then with `Error: Hook timed out in 10000ms` at the `afterAll` of `plugins/bdk/tests/evals.test.ts`. Both free eval checks (`plugins/bdk/tests/evals.test.ts` and `tests/eval-suites.test.ts`) keep every scaffold they build until one recursive delete at the end of the file. Every scaffold is a git repository, so the tree grows with each case (measured: 6.4k entries for `evals.test.ts`, 18.4k entries and 45 MB for `eval-suites.test.ts`), and under the load of 87 test files that delete took 2-15 s. Two of four full runs failed on it.

## What Changes

- Each scaffold, launcher and planted directory of the two free checks is deleted when the test that built it finishes, instead of in one `afterAll` at the end of the file. The `afterAll` only removes the then empty scratch root.
- No timeout is raised: the cost of a cleanup now follows one scaffold (at most 607 entries, 776 ms under full load), not the whole suite.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `skill-evals`: the requirement "No paid evals in CI, free checks of the suite" gains that the check deletes each scaffold when it is done with it, so its run time and cleanup do not depend on how many cases the suites hold.

## Impact

- Code: `plugins/bdk/tests/evals.test.ts`, `tests/eval-suites.test.ts` (test helpers only).
- No change a BDK user sees: no skill, agent, hook, `bdk` command, settings key or flow changes, so the Change has no Docs task group and no docs/guide/ or docs/concepts/ page changes.
- Other tests that delete a temporary tree in `afterAll` (`cli.test.ts`, `check.test.ts`, `diagnostics-cli.test.ts`, `findings-cli.test.ts`, `architecture-lint.test.ts`) build a few small directories, not scaffolds; they stay as they are (design.md, D3).

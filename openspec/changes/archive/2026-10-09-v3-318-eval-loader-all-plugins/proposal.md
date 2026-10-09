## Why

Tracks #318. The free CI check of eval cases (spec `skill-evals`, design D6 of `v3-189-eval-setup`) lives in `plugins/bdk/tests/evals.test.ts` and covers `plugins/bdk/evals/` only. `plugins/bdk-skill-kit/evals/` has no check at all, and `plugins/bdk-craft/evals/` is covered only by `tests/craft-skills.test.ts`, which reads the admission record, not whether the cases load. A case with broken YAML, a broken grader or a broken scaffold in those plugins passes `pnpm check`: replacing the `case.yaml` of `skill-check-internal-error` with unparsable YAML, or pointing its `scaffold_script` at a missing file, leaves every test green today.

## What Changes

- A new repository test `tests/eval-suites.test.ts` finds every `plugins/<name>/evals/` that holds a case and, for each, loads every case with the pinned `claude plugin eval` loader at a cost ceiling of zero and with the grants that plugin's eval README recommends, and runs every case's `scaffold_script` the way the harness runs it. It fails naming the plugin and the case or script.
- The test proves it detects a broken case (the planted-case check moves here from `plugins/bdk/tests/evals.test.ts`) and fails when a plugin with cases has no grants listed, so a new suite cannot slip past it.
- `plugins/bdk/tests/evals.test.ts` keeps what is specific to the `bdk` suite (shared fixtures, layout and tags, launcher, offline `gh` stand-in) and drops the loader and case-scaffold checks that moved.
- Every case loads and every scaffold exits 0 today; any case the new check shows broken is fixed.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `skill-evals`: "No paid evals in CI, free checks of the suite" covers the eval cases of every plugin, not only `plugins/bdk/evals/`.

## Impact

- Code: new `tests/eval-suites.test.ts`; `plugins/bdk/tests/evals.test.ts` loses its loader and case-scaffold checks.
- CI: `pnpm check` (the `check` job of PR CI) runs the new test; no paid run, no credentials.
- Docs: `CONTRIBUTING.md` says PR CI loads every plugin's eval cases for free. Nothing a BDK user sees changes (no skill, agent, hook, `bdk` command or settings key), so no `docs/guide/` or `docs/concepts/` page changes and there is no Docs task group; the PR body carries `Docs-impact: none`.

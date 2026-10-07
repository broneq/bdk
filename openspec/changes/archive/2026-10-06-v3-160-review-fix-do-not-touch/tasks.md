# Tasks

## 1. Reproduce

- [x] 1.1 Add the E2E test `commits a fix under the do-not-touch of a part (#160)` to `kernel/src/commit/tests/commit.e2e.ts`: an executed Change whose part 01 declares `do-not-touch: [src/billing/**]`, an open `review-fix` ticket and a fix in `src/billing/invoice.ts`. Verify `bdk commit <change-id>` refuses it today with `policy/do-not-touch`.

## 2. Diff check (`kernel-loops`, Diff check)

- [x] 2.1 Change the unit tests of the Change target in `kernel/src/part/tests/diff.test.ts` and `kernel/src/commit/tests/commit.test.ts` to expect no refusal for a path under a started part's `do-not-touch`. Verify it fails.
- [x] 2.2 Give the Change target no forbidden globs in `ownSets` (`kernel/src/part/use-cases/diff.ts`, design D-1). Verify the 1.1 and 2.1 tests pass.

## 3. Acceptance

- [x] 3.1 Verify the scenario `review fix touches a do-not-touch path` end to end through the 1.1 test against the built bundle, and that `policy/do-not-touch` still refuses a task target (`exit 2 policy/do-not-touch`).
- [x] 3.2 Run the gates: `pnpm lint && pnpm format:check && pnpm typecheck && pnpm knip`, `pnpm test:unit`, `pnpm build && pnpm test:e2e`, `pnpm test:contract`, `pnpm skill-check`, `openspec validate v3-160-review-fix-do-not-touch --strict`.

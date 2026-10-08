# Tasks

## 1. Guard test

- [x] 1.1 Write `plugins/bdk/tests/refused-names.test.ts` (D2) and verify it fails on today's tree, naming `report.md` in the skills and `src/findings/store/log.ts`

## 2. CLI

- [x] 2.1 Change the CLI tests (`src/findings`, `src/git`, `src/run`, `tests/git.test.ts`, `tests/findings-cli.test.ts`) to `review.md` and verify they fail
- [x] 2.2 Change `src/findings/store/log.ts`, `src/findings/use-cases/report.ts`, `src/findings/commands/report.ts`, `src/git/store/rounds.ts`, `src/git/commands/scope.ts`, `src/run/store/status.ts`, `src/run/domain/status.ts` to `review.md`; verify `pnpm --filter @bdk/bdk test` passes

## 3. Skills, evals and docs

- [x] 3.1 Rename graders and change fixtures and grader paths under `plugins/bdk/evals` to `review.md` (D4); verify the free eval check in `tests/evals.test.ts` passes
- [x] 3.2 Change `judge`, `triage`, `review-group`, `review-integration`, `review-round`, `auto-review`, `plan-fixes`, `pr-review`, `pr-review-round` to `review.md` (D3); verify `skill-check` passes and the guard test of 1.1 passes
- [x] 3.3 Change `docs/design/2026-10-07-v3-architecture.md` (review flow, run artifacts, resume row 6) and the eval README; verify `grep -rn 'report\.md'` outside archives and `docs/v3-draft1/` finds none

## 4. Acceptance and gates

- [x] 4.1 Run `judge-levels` and `auto-review-first-round` in a separate eval workspace; verify `review/round-1/review.md` exists and record the runs in design.md "Eval runs"
- [x] 4.2 Run every check CI runs (`.github/workflows/`, `pnpm check`), `openspec validate v3-252-rename-refused-files --strict` and `openspec validate --specs --strict`; verify all pass

## 5. Docs

- [x] 5.1 Change the Concepts pages `docs/concepts/run-state.md`, `orchestrators.md`, `findings.md` and `agents.md` to `review.md`, and regenerate the Reference with `pnpm docs:reference`; verify `pnpm check` passes its stale-Reference and name checks

# Tasks

## 1. Offline gh stand-in

- [x] 1.1 Failing tests for the stand-in: `gh pr view 7` and `gh pr view <url>` by number, unknown number, `gh repo view --json nameWithOwner`, `gh api user`, `gh api .../reviews -X POST --input` recorded with id and state, 422 on input without `event`
- [x] 1.2 Extend `plugins/bdk/evals/fixtures/bin/gh`; tests green

## 2. Eval fixture and cases

- [x] 2.1 Shared fixture `plugins/bdk/evals/fixtures/monthly-report-pr.sh`: `monthly-report` as PR 7 of a bare `origin`, checkout on `main`, `prs/7.json`, the stand-in
- [x] 2.2 Cases `pr-review-post` and `pr-review-confirm` (orchestrator) with scaffolds and graders
- [x] 2.3 Free check green: `pnpm exec vitest run plugins/bdk/tests/evals.test.ts`

## 3. Review blocks: `--workdir`, `--change`, `--intent` (with /skill-creator)

- [x] 3.1 `review-group`, `review-integration`, `judge`: the three optional inputs; agents `reviewer.md`, `integration-reviewer.md`, `judge.md` name them

## 4. Lead skill and orchestrator (with /skill-creator)

- [x] 4.1 Lead skill `skills/pr-review-round/SKILL.md`; `agents/lead.md` names PR review
- [x] 4.2 Thin orchestrator `skills/pr-review/SKILL.md` with `references/comment-templates.md`
- [x] 4.3 Try `/bdk:pr-review` in scratch projects built from both case scaffolds with `claude -p --plugin-dir plugins/bdk`; fix what the runs show

## 5. Documentation

- [x] 5.1 `plugins/bdk/evals/README.md`: the pr-review cases, grants and run command
- [x] 5.2 `CLAUDE.md` "Current state"

## 6. Acceptance and gates

- [x] 6.1 Run both eval cases with `claude plugin eval` (one arm); re-run the three review block cases once with the plugin; record the results in design.md "Measurements"
- [x] 6.2 Every check CI runs (`pnpm check` and the other jobs of `.github/workflows/pr.yml`), `openspec validate v3-205-bdk-pr-review --strict`, `openspec validate --specs --strict`

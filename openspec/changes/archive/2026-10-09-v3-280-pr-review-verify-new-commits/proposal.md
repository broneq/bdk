# Proposal

## Why

Tracks #280.

`/bdk:pr-review --verify` (#256, archived Change `2026-10-08-v3-256-pr-review-verify-multi`) re-checks only the previous review's `blocker` and `should-fix` findings with the judge and can approve a pull request whose fix commits nobody read: a fix that closes the old blocker and opens a new one passes. Design D3 of #256 left the review of the new commits out for scope and speed and named this follow-up. Verify must approve only code it read.

## What Changes

- The verify round of `pr-review-round` also runs the review blocks on the commits added since the previous review: `/bdk:pr-review --verify` passes the previous review's head (the `head=` of its summary marker) to the lead as `--since <sha>`; the lead records the groups with `bdk git groups <since>` when that commit is an ancestor of the current head, else (a force-push, or a commit no longer fetched) with `bdk git groups origin/<base>`, the merge base. It seeds the previous findings into the round's log first, then starts one `bdk:reviewer` per group, the `bdk:integration-reviewer` and the `bdk:judge`, which levels the previous and the new findings in the same round. With no new commit it starts only the judge, as before.
- The judge levels the later of two findings that repeat each other `not-a-problem`, naming the earlier id, so a reviewer who reports a previous finding again never makes the judge close the previous thread.
- The verify review posts each new `blocker` and `should-fix` finding inside the pull request's diff as an inline comment, lists new findings outside the diff and new `nice-to-have` findings in its summary, and its verdict counts them: `request-changes` when a left previous finding or a new finding is `blocker`. `result.md` of a verify round names the reviewed range on a `Reviewed:` line.
- The verify template drops the note "commits since ... were checked only against these findings" and says instead which commits were reviewed (the commits since the previous head, or the whole pull request after a force-push).
- Eval: the fixture `monthly-report-pr-regressed` (from `monthly-report-pr-reviewed`, one more commit that fixes the report blocker and adds a new one) and the case `pr-review-verify-regression`.
- Fixes the git conflict markers that the merge of #277 left in `pr-review`, `pr-review-round` and the main spec `bdk-pr-review`, and adds a test that fails on conflict markers in tracked files.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `bdk-pr-review`: the verify round reviews the commits since the previous review; new findings in the verify review and its verdict; the eval case.
- `review-blocks`: the judge levels the later of two repeating findings `not-a-problem`.

## Impact

- Changed: `plugins/bdk/skills/pr-review/SKILL.md` and `references/comment-templates.md`, `plugins/bdk/skills/pr-review-round/SKILL.md`, `plugins/bdk/skills/judge/SKILL.md`, `plugins/bdk/evals/README.md`, the case `pr-review-verify` (its grader on reviewers), `CLAUDE.md` "Current state".
- New: `plugins/bdk/evals/fixtures/monthly-report-pr-regressed.sh`, the case `pr-review-verify-regression`, a root test against conflict markers.
- No new block, agent or CLI command: the delta range is `bdk git groups <since>` (#186), whose merge base with the head is `<since>` itself when it is an ancestor (design D2).
- User docs: `docs/guide/workflow.md` ("Any pull request"), `docs/concepts/stages.md`, `docs/concepts/orchestrators.md` (the verify diagram and text); Reference regenerated with `pnpm docs:reference`.
- Out of scope: stacked-PR expansion; per-role model and effort settings (#274, #278); what the reviewers read of the project instructions (#273).

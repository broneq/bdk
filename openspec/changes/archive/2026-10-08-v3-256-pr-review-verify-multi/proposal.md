# Proposal

## Why

Tracks #256.

`/bdk:pr-review` (#205, archived Change `2026-10-08-v3-205-bdk-pr-review`) reviews one pull request per call and posts one review whose inline comments and summary carry the hidden marker `bdk-pr-review v3` (design D7). Two things v2 had are missing: after the author answers a review, nothing checks whether the requested changes were made and closes the threads that are done (verify mode), and a reviewer with several pull requests runs the command once per pull request and confirms each review on its own. Design D3 and the Non-Goals of #205 named both as this follow-up.

## What Changes

- `/bdk:pr-review --verify <pr>` re-checks the previous review: it reads the newest review the current user posted with the summary marker and its open threads whose first comment holds the finding marker with level `blocker` or `should-fix`, plus the `blocker` and `should-fix` lines of that summary's "Outside the diff" section, writes them to `.bdk/runs/pr-<N>/previous.json`, and starts the lead in verify mode. The lead seeds a new round's findings log with them and runs only the judge, at the current head, with the existing `--workdir`, `--change`, `--intent` inputs. A finding the judge levels `not-a-problem` is fixed; any other level is left. The main thread renders one verify review from a new template (fixed and left findings, verdict `request-changes` when a `blocker` is left, else `approve`, no inline comments), confirms it as today, posts it, and then resolves the threads of the fixed findings with `resolveReviewThread`, no other thread.
- Several pull requests in one call: `/bdk:pr-review <pr> <pr> ... [--verify]`. The main thread checks and briefs each, starts one background `bdk:lead` per pull request in one message (at most `execution.max-parallel`), shows every review when all have returned, and asks one confirmation for all of them.
- `pr-review-round` no longer reads `FETCH_HEAD`, which parallel leads in one repository overwrite: it checks the head with `git ls-remote`, fetches with `--no-write-fetch-head`, and retries a fetch once on a ref lock.
- The offline `gh` stand-in answers `gh api graphql` for the reviews and review threads of a pull request (built from the recorded reviews) and records `resolveReviewThread`.
- Eval: the shared fixture `monthly-report-pr-reviewed.sh` (pull request 7 with a posted review and a new head commit that fixes only the parse blocker), the case `pr-review-verify`, the fixture `monthly-report-two-prs.sh` (pull request 7 plus a clean pull request 8) and the case `pr-review-several`.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `bdk-pr-review`: verify mode, several pull requests per call, a fetch safe for parallel leads, new eval cases.
- `skill-evals`: the offline `gh` stand-in answers review threads and records resolved threads.

## Impact

- Changed: `plugins/bdk/skills/pr-review/SKILL.md` and `references/comment-templates.md`, `plugins/bdk/skills/pr-review-round/SKILL.md`, `plugins/bdk/evals/fixtures/bin/gh` and its test in `plugins/bdk/tests/evals.test.ts`, `plugins/bdk/evals/README.md`, `CLAUDE.md` "Current state".
- New: `plugins/bdk/evals/fixtures/monthly-report-pr-reviewed.sh`, `monthly-report-two-prs.sh`, cases `pr-review-verify`, `pr-review-several`.
- No new block, agent or CLI command: the judge is the check of a previous finding (design D1), and no eval showed a problem a helper would solve.
- Out of scope: a review of the commits added since the previous review in verify mode (a follow-up issue, design D3); stacked-PR expansion; `/bdk:auto-review` (#201).

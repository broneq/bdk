# Proposal

## Why

Tracks #205.

BDK v3 has the review blocks `review-group`, `review-integration` and `judge` (#193) and the lead agent `bdk:lead` (#200), but nothing reviews a GitHub pull request. v2 did it with `/bdk:pr-review` (one general-purpose subagent per PR running the whole `/bdk:cr --inline` engine); draft 1 rebuilt it as a fork role with a brief, a decision page and a `bdk review render` kernel command. The architecture (`docs/design/2026-10-07-v3-architecture.md`, D1 hybrid A+C, "Layers", "Catalog"; ADR-0003) names `/bdk:pr-review` as a thin main-thread skill that starts a `bdk:lead` with a stage skill composing `review-group`, `review-integration` and `judge` on a GitHub PR, and posts PR comments.

The review blocks read the Change from `openspec/changes/<change>/` and the code from the working directory. A pull request is neither: its head is another commit than the user's checkout, and its intent is the PR description, with or without an OpenSpec Change in the diff. The blocks need a way to read a checkout other than the working directory and an intent other than a Change of the run directory's name.

## What Changes

- New thin orchestrator `/bdk:pr-review [<pr-url> | <number>]` (`plugins/bdk/skills/pr-review/`): checks the configuration and the PR (open, of this repository), writes the PR brief `.bdk/runs/pr-<N>/pr.md`, starts one `bdk:lead` with the stage skill, reads the judged round, renders one review (inline comments for `blocker` and `should-fix` findings inside the diff, the rest in the summary, a computed verdict), shows it, posts it with `gh api .../reviews` only after the user confirms (or when `policy.questions: decide-and-record` or the request itself says to post without asking), and forces `COMMENT` on the user's own PR.
- New lead skill `pr-review-round` (`plugins/bdk/skills/pr-review-round/`, not user-invocable) on `bdk:lead`: fetches the PR head and base, makes a detached worktree of the head under the run directory, finds the OpenSpec Change the PR carries, records the groups with `bdk git groups` in the worktree, runs one `bdk:reviewer` per group in parallel batches, then `bdk:integration-reviewer`, then `bdk:judge`, removes the worktree and writes `.bdk/runs/pr-<N>/result.md`. It runs no checks and no E2E: the PR's CI runs them.
- `review-group`, `review-integration` and `judge` take three optional inputs: `--workdir <path>` (the checkout to read, as `implement-part` has it), `--change <path>|none` (the Change directory relative to the work directory, archived or not, instead of the run directory's name), and `--intent <file>` (a file stating the intent, the PR brief). Without them they behave as before.
- The offline `gh` stand-in answers `gh pr view <number|url>`, `gh repo view`, `gh api user` and records `gh api repos/<o>/<r>/pulls/<n>/reviews -X POST --input <file>`.
- Eval: a shared fixture `monthly-report-pr.sh` (the `monthly-report` Change with its two seeded bugs as PR #7 of an offline remote, the user's checkout on `main`), the orchestrator cases `pr-review-post` (the review is posted with `REQUEST_CHANGES` and inline comments on the seeded bugs) and `pr-review-confirm` (without the user's go-ahead nothing is posted and the verdict is asked).

## Capabilities

### New Capabilities
- `bdk-pr-review`: the `/bdk:pr-review` orchestrator and the `pr-review-round` lead skill - PR input and checks, the brief, the worktree, groups, reviewers, integration, judge, the result, the rendered review, the verdict and its confirmation, posting.

### Modified Capabilities
- `review-blocks`: the optional inputs `--workdir`, `--change` and `--intent`.
- `skill-evals`: the offline `gh` stand-in answers pull requests by number and URL, the repository, the user, and records posted reviews.

## Impact

- New: `plugins/bdk/skills/pr-review/` (with `references/comment-templates.md`), `plugins/bdk/skills/pr-review-round/`.
- Changed: `plugins/bdk/skills/review-group/`, `review-integration/`, `judge/`, the agents `reviewer.md`, `integration-reviewer.md`, `judge.md`, `lead.md` (names PR review); `plugins/bdk/evals/fixtures/bin/gh` and its test.
- `plugins/bdk/evals/`: one fixture, two cases, README grants and run command.
- `CLAUDE.md` "Current state".
- No CLI change: `bdk git groups` runs in the worktree, `bdk findings list|report` read the round; no eval asked for a helper.
- Out of scope: `/bdk:auto-review` and the `review-round` lead skill (#201); a verify mode that checks a previous review's threads, several PRs per call, and stacked-PR expansion (named as follow-up, not v3.0 acceptance); checks and E2E on the PR (its CI runs them).

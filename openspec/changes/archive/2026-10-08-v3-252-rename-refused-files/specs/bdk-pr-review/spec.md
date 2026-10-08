# Spec Delta

## MODIFIED Requirements

### Requirement: Review round of a pull request

`pr-review-round` SHALL fetch the pull request's head (`pull/<number>/head`) and its base branch from `origin`, and SHALL stop with `Status: blocked` when the fetched head is not the head commit of the brief. It SHALL review the head in a detached git worktree `<run dir>/worktree`, made fresh for every run, and SHALL leave the user's checkout, branch and index unchanged. The round directory SHALL be `<run dir>/review/round-<N>/` with the lowest `N` whose directory holds no `review.md`, and every round SHALL review the whole pull request, from the merge base of the head and the base branch.

The Change of the pull request SHALL be the one directory under `openspec/changes/` (archived or not) holding a `proposal.md` that the range adds or changes; with none or several, the review SHALL have no Change. The lead SHALL record the groups with `bdk git groups origin/<base> --record <round dir>`, run in the worktree, adding `--plan <change>/plan/parts` when the Change has plan parts. It SHALL then start one `bdk:reviewer` per group except `integration`, at most `execution.max-parallel` at once as foreground `Agent` calls in one message; then one `bdk:integration-reviewer`; then one `bdk:judge`; each with the round directory, `--workdir <worktree>`, `--change <change>|none` and `--intent <run dir>/pr.md`, and `model` set from `models.<role>` when the configuration sets it. It SHALL run no check and no E2E.

After the judge, the lead SHALL remove the worktree and write `<run dir>/result.md`, starting with `Status: done` or `Status: blocked`, naming the round directory, the range, the head commit and the Change, and on `blocked` a `## Blockers` section with the reason. A range with no changed text file SHALL be `Status: done` with no round of reviewers and the line `No changes to review.`

#### Scenario: Two-part Change as a pull request

- **WHEN** the lead runs on pull request 7, whose head carries the Change `monthly-report` with plan parts `01` and `02`
- **THEN** `round-1/groups.json` holds the groups `p01`, `p02`, `unplanned` and `integration`, three `bdk:reviewer` agents start in one message before the integration reviewer, the judge writes `round-1/review.md`, and `result.md` starts with `Status: done`

#### Scenario: User's checkout untouched

- **WHEN** the user's checkout is on `main` with an uncommitted file and the lead reviews pull request 7
- **THEN** after the run the checkout is still on `main` with the same uncommitted file, and `git worktree list` no longer lists `<run dir>/worktree`

#### Scenario: Head moved

- **WHEN** the head fetched from `pull/7/head` is not the head commit written in the brief
- **THEN** no reviewer starts and `result.md` starts with `Status: blocked` naming both commits

### Requirement: Eval cases of the PR review

The suite SHALL hold the orchestrator cases `pr-review-post` and `pr-review-confirm` on a shared fixture `monthly-report-pr`: the `monthly-report` project with its two seeded bugs pushed as pull request 7 of a bare `origin` inside the workspace, the user's checkout on `main`, and the offline `gh` stand-in. `pr-review-post` SHALL grade that one review was posted with `REQUEST_CHANGES` and inline comments on the parse bug and the cents and dollars seam, that the round report exists, and that the user's checkout stayed on `main`. `pr-review-confirm` SHALL grade that no review was posted and that the reply asks for the verdict.

#### Scenario: Fixture pull request reviewed

- **WHEN** `pr-review-post` runs with the plugin
- **THEN** `.git/bdk-eval/reviews/7-1.json` holds the event `REQUEST_CHANGES` and inline comments on `src/parse.js` and on the report code, and `.bdk/runs/pr-7/review/round-1/review.md` exists

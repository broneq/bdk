# bdk-pr-review Specification

## Purpose

Defines the PR review of the `bdk` plugin: the thin orchestrator `/bdk:pr-review`, which starts one `bdk:lead` agent that reviews a GitHub pull request with the review blocks, and turns the judged findings into one GitHub review that is posted only after the user confirms it.

## Requirements

### Requirement: Skills and agent

The `bdk` plugin SHALL ship the skills `pr-review` (`skills/pr-review/`, the user command `/bdk:pr-review`) and `pr-review-round` (`skills/pr-review-round/`, not user-invocable). `/bdk:pr-review` SHALL start one `bdk:lead` agent whose prompt names the skill `bdk:pr-review-round` and the arguments `<number> --run-dir <absolute .bdk/runs/pr-<number>>`; it SHALL start no reviewer itself and edit no project file. `pr-review-round` SHALL run only on `bdk:lead`; started anywhere else it SHALL do nothing and name `/bdk:pr-review`.

#### Scenario: Lead started with its skill

- **WHEN** `/bdk:pr-review https://github.com/bdk-eval/repo/pull/7` runs in a configured project whose repository is `bdk-eval/repo`
- **THEN** the main conversation starts one `bdk:lead` agent whose prompt names `bdk:pr-review-round` and `7 --run-dir <absolute .bdk/runs/pr-7>`, and starts no `bdk:reviewer` itself

### Requirement: Start of a PR review

`/bdk:pr-review [<pr-url> | <number>]... [--verify]` SHALL get the configuration from its own `bdk config show` block and, in a project that is not configured or whose configuration is invalid, stop with the line that command prints. Without a pull request argument it SHALL take the pull request of the current branch. It SHALL read each pull request with `gh pr view` and leave out, starting nothing for it, one that does not exist, whose state is not `OPEN`, or whose repository is not the repository of the working directory (`gh repo view`), saying why. For each pull request it SHALL write the brief `.bdk/runs/pr-<number>/pr.md`, holding the number, URL, title, author, draft state, base branch, head branch, head commit, description and linked issues, and start one lead per pull request, in the background when `execution.lead` is `background` and in the foreground when it is `foreground`, with `model` set to `models.lead` when the configuration sets it. With several pull requests, background leads SHALL start in one message, at most `execution.max-parallel` at a time, and the reviews SHALL be rendered only after every lead has returned.

#### Scenario: Closed pull request

- **WHEN** `/bdk:pr-review 7` runs and pull request 7 is `MERGED`
- **THEN** no agent starts, nothing is posted, and the reply says the pull request is not open

#### Scenario: Pull request of another repository

- **WHEN** `/bdk:pr-review https://github.com/other/repo/pull/3` runs in a project whose repository is `bdk-eval/repo`
- **THEN** no agent starts and the reply says to run the review in a checkout of `other/repo`

#### Scenario: Two pull requests in one call

- **WHEN** `/bdk:pr-review 7 8` runs and both pull requests are open in the project's repository
- **THEN** two `bdk:lead` agents start in one message, one with `7 --run-dir <absolute .bdk/runs/pr-7>` and one with `8 --run-dir <absolute .bdk/runs/pr-8>`, and nothing is shown or posted before both returned

### Requirement: Review round of a pull request

<<<<<<< HEAD
`pr-review-round` SHALL check the pull request's head with `git ls-remote origin refs/pull/<number>/head` and stop with `Status: blocked` when it is not the head commit of the brief. It SHALL fetch the head and the base branch from `origin` without writing `FETCH_HEAD` (`git fetch --no-write-fetch-head origin pull/<number>/head <base>`), and SHALL run a fetch that failed on a lock once more, so that leads of several pull requests can run in one repository at once. It SHALL review the head in a detached git worktree `<run dir>/worktree`, made fresh for every run, and SHALL leave the user's checkout, branch and index unchanged. The round directory SHALL be `<run dir>/review/round-<N>/` with the lowest `N` whose directory holds no `review.md`, and every review round SHALL review the whole pull request, from the merge base of the head and the base branch.
=======
`pr-review-round` SHALL fetch the pull request's head (`pull/<number>/head`) and its base branch from `origin`, and SHALL stop with `Status: blocked` when the fetched head is not the head commit of the brief. It SHALL review the head in a detached git worktree `<run dir>/worktree`, made fresh for every run, and SHALL leave the user's checkout, branch and index unchanged. The round directory SHALL be `<run dir>/review/round-<N>/` with the lowest `N` whose directory holds no `review.md`, and every round SHALL review the whole pull request, from the merge base of the head and the base branch.
>>>>>>> f6c0a331 (feat(bdk)!: rename the review round record to review.md)

The Change of the pull request SHALL be the one directory under `openspec/changes/` (archived or not) holding a `proposal.md` that the range adds or changes; with none or several, the review SHALL have no Change. In a review round the lead SHALL record the groups with `bdk git groups origin/<base> --record <round dir>`, run in the worktree, adding `--plan <change>/plan/parts` when the Change has plan parts. It SHALL then start one `bdk:reviewer` per group except `integration`, at most `execution.max-parallel` at once as foreground `Agent` calls in one message; then one `bdk:integration-reviewer`; then one `bdk:judge`; each with the round directory, `--workdir <worktree>`, `--change <change>|none` and `--intent <run dir>/pr.md`, and `model` set from `models.<role>` when the configuration sets it. It SHALL run no check and no E2E.

After the judge, the lead SHALL remove the worktree and write `<run dir>/result.md`, starting with `Status: done` or `Status: blocked`, naming the mode (`review` or `verify`), the round directory, the range, the head commit and the Change, and on `blocked` a `## Blockers` section with the reason. A range with no changed text file SHALL be `Status: done` with no round of reviewers and the line `No changes to review.`

#### Scenario: Two-part Change as a pull request

- **WHEN** the lead runs on pull request 7, whose head carries the Change `monthly-report` with plan parts `01` and `02`
- **THEN** `round-1/groups.json` holds the groups `p01`, `p02`, `unplanned` and `integration`, three `bdk:reviewer` agents start in one message before the integration reviewer, the judge writes `round-1/review.md`, and `result.md` starts with `Status: done`

#### Scenario: User's checkout untouched

- **WHEN** the user's checkout is on `main` with an uncommitted file and the lead reviews pull request 7
- **THEN** after the run the checkout is still on `main` with the same uncommitted file, and `git worktree list` no longer lists `<run dir>/worktree`

#### Scenario: Head moved

- **WHEN** the head `git ls-remote origin refs/pull/7/head` prints is not the head commit written in the brief
- **THEN** no reviewer starts and `result.md` starts with `Status: blocked` naming both commits

#### Scenario: Another lead fetches at the same time

- **WHEN** the leads of pull requests 7 and 8 fetch from `origin` in one repository at once
- **THEN** each lead makes its worktree at the head commit of its own brief, whatever the other fetched

### Requirement: Rendered review and verdict

After the lead returns `Status: done`, `/bdk:pr-review` SHALL read the round's findings with `bdk findings list` and render one review from `references/comment-templates.md`:

- each `blocker` and `should-fix` finding whose line lies inside a hunk of `git diff <range> -- <file>` on the new side SHALL be an inline comment on that line; one outside the diff SHALL go to the summary's section of findings outside the diff;
- each `nice-to-have` finding SHALL be a line of the summary; a `not-a-problem` finding SHALL NOT be posted;
- the computed verdict SHALL be `request-changes` when any finding is `blocker`, else `approve`;
- the summary SHALL end with a hidden marker naming `bdk-pr-review`, the verdict and the reviewed head commit.

Before anything is posted it SHALL show the user the computed verdict and every finding it will post, the whole `nice-to-have` list included.

#### Scenario: Blockers request changes

- **WHEN** the judged round holds two `blocker` findings on changed lines of `src/parse.js` and `src/report.js` and one `nice-to-have`
- **THEN** the review has the event `REQUEST_CHANGES`, inline comments on those two lines, and the `nice-to-have` finding in the summary

### Requirement: Confirmation and posting

Nothing SHALL reach GitHub before the user confirms it, except when `policy.questions` is `decide-and-record` or the user's request says to post without asking; then the computed verdict SHALL be posted and the reply SHALL say that it was posted without a question. With `policy.questions: stop` (the default) it SHALL ask with `AskUserQuestion` whether to post with the computed verdict (recommended), post with the other verdict, post as a comment, or not post; when that tool is not available it SHALL put the question at the end of the reply and stop without posting. With several pull requests it SHALL ask once for all of them, after showing every review: one question per pull request in one `AskUserQuestion` call for up to four, and for more one question whether to post every review with its computed verdict (recommended), choose per pull request, or post none.

It SHALL post exactly one review per pull request and run with `gh api repos/<owner>/<repo>/pulls/<number>/reviews -X POST --input <file>`, holding the head commit, the event, the summary and the inline comments, from a file written under the run directory. On the user's own pull request (`gh api user` is the author) the event SHALL be `COMMENT`. When GitHub rejects an inline comment's place, it SHALL move the inline comments into the summary and post once more, never the same payload twice. A failure to post one pull request's review SHALL NOT stop the others. The reply SHALL name each posted review's URL and verdict.

#### Scenario: Posted on request

- **WHEN** the user asked to review pull request 7 and post the review without asking, and the round holds blockers
- **THEN** one review is posted with the event `REQUEST_CHANGES`, and the reply says it was posted without a question

#### Scenario: Nothing posted without the user

- **WHEN** `/bdk:pr-review 7` runs with `policy.questions: stop` in a session without `AskUserQuestion`
- **THEN** no `gh api .../reviews` call runs and the reply ends with the question which verdict to post

#### Scenario: Own pull request

- **WHEN** the author of pull request 7 is the user `gh api user` names and the user confirms `request-changes`
- **THEN** the review is posted with the event `COMMENT` and the summary states the verdict

#### Scenario: One confirmation for two pull requests

- **WHEN** `/bdk:pr-review 7 8` runs with `policy.questions: stop` and `AskUserQuestion` available
- **THEN** both reviews are shown, then one `AskUserQuestion` call asks one question for pull request 7 and one for pull request 8

### Requirement: Eval cases of the PR review

The suite SHALL hold the orchestrator cases `pr-review-post` and `pr-review-confirm` on a shared fixture `monthly-report-pr`: the `monthly-report` project with its two seeded bugs pushed as pull request 7 of a bare `origin` inside the workspace, the user's checkout on `main`, and the offline `gh` stand-in. `pr-review-post` SHALL grade that one review was posted with `REQUEST_CHANGES` and inline comments on the parse bug and the cents and dollars seam, that the round report exists, and that the user's checkout stayed on `main`. `pr-review-confirm` SHALL grade that no review was posted and that the reply asks for the verdict.

It SHALL also hold `pr-review-verify` on the fixture `monthly-report-pr-reviewed`, which adds to `monthly-report-pr` a recorded review of pull request 7 by the eval user with the summary marker and inline `blocker` threads on the parse bug and on the cents and dollars seam, and a new head commit that fixes only the parse bug; it SHALL grade that only the parse thread is resolved and that a second review with `REQUEST_CHANGES` and the verify marker is posted. And it SHALL hold `pr-review-several` on the fixture `monthly-report-two-prs`, which adds a correct pull request 8; it SHALL grade that both reviews are posted, `REQUEST_CHANGES` on 7 and `APPROVE` on 8, from two `bdk:lead` agents.

#### Scenario: Fixture pull request reviewed

- **WHEN** `pr-review-post` runs with the plugin
<<<<<<< HEAD
- **THEN** `.git/bdk-eval/reviews/7-1.json` holds the event `REQUEST_CHANGES` and inline comments on `src/parse.js` and on the report code, and `.bdk/runs/pr-7/review/round-1/review.md` exists

#### Scenario: Fixed blocker verified

- **WHEN** `pr-review-verify` runs with the plugin
- **THEN** `.git/bdk-eval/resolved.json` lists the thread of the `src/parse.js` comment and no other, and `.git/bdk-eval/reviews/7-2.json` holds the event `REQUEST_CHANGES` and `kind=verify-summary`

#### Scenario: Two pull requests reviewed

- **WHEN** `pr-review-several` runs with the plugin
- **THEN** `.git/bdk-eval/reviews/7-1.json` holds `REQUEST_CHANGES` and `.git/bdk-eval/reviews/8-1.json` holds `APPROVE`

### Requirement: Verify mode

`/bdk:pr-review --verify <pr>` SHALL re-check the previous review of the current user (`gh api user`): the newest review by that user whose body holds `bdk-pr-review v3 kind=summary` or `kind=verify-summary`, read with one `gh api graphql` query for the pull request's reviews and review threads. The findings to check SHALL be each unresolved thread whose first comment is that user's and holds `bdk-pr-review v3 kind=finding` with level `blocker` or `should-fix`, and each `blocker` or `should-fix` line of that review's section of findings outside the diff; it SHALL write them to `<run dir>/previous.json` with the thread id (or none), file, line, level, summary and evidence. Without a previous review, or with no finding to check, it SHALL start nothing and say so.

The lead, started with `--verify`, SHALL fetch and make the worktree as in a review round, add each finding of `previous.json` to the new round's log with `bdk findings add --source previous-review`, record each finding's id next to its thread in `<round dir>/previous.json`, and start no reviewer: only one `bdk:judge` with `--workdir`, `--change` and `--intent`. A finding the judge levels `not-a-problem` SHALL count as fixed; any other level as left.

The main thread SHALL render one review from the verify template: the fixed and the left findings with the judge's reasons, no inline comments, the verdict `request-changes` when a left finding is `blocker` and `approve` otherwise, a note that commits since the previous review were checked only against its findings, and the marker `bdk-pr-review v3 kind=verify-summary verdict=<v> head=<sha>`. It SHALL confirm and post it under the requirement "Confirmation and posting", and only after the review was posted SHALL it resolve the thread of each fixed finding with the `resolveReviewThread` mutation, and no other thread.

#### Scenario: One blocker fixed

- **WHEN** the previous review of pull request 7 has `blocker` threads on `src/parse.js` and `src/report.js`, a new head commit fixes only the parse bug, and the user asked to post without asking
- **THEN** one review is posted with the event `REQUEST_CHANGES` that lists the parse finding as fixed and the report finding as left, and then only the `src/parse.js` thread is resolved

#### Scenario: Nothing to verify

- **WHEN** `/bdk:pr-review --verify 7` runs and the current user posted no review with the marker on pull request 7
- **THEN** no agent starts, nothing is posted, and the reply names `/bdk:pr-review 7`

#### Scenario: Not posted, nothing resolved

- **WHEN** a verify review is computed and the user chooses not to post it
- **THEN** no review is posted and no thread is resolved
=======
- **THEN** `.git/bdk-eval/reviews/7-1.json` holds the event `REQUEST_CHANGES` and inline comments on `src/parse.js` and on the report code, and `.bdk/runs/pr-7/review/round-1/review.md` exists
>>>>>>> f6c0a331 (feat(bdk)!: rename the review round record to review.md)

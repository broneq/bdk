## MODIFIED Requirements

### Requirement: Review round of a pull request

`pr-review-round` SHALL check the pull request's head with `git ls-remote origin refs/pull/<number>/head` and stop with `Status: blocked` when it is not the head commit of the brief. It SHALL fetch the head and the base branch from `origin` without writing `FETCH_HEAD` (`git fetch --no-write-fetch-head origin pull/<number>/head <base>`), and SHALL run a fetch that failed on a lock once more, so that leads of several pull requests can run in one repository at once. It SHALL review the head in a detached git worktree `<run dir>/worktree`, made fresh for every run, and SHALL leave the user's checkout, branch and index unchanged. The round directory SHALL be `<run dir>/review/round-<N>/` with the lowest `N` whose directory holds no `review.md`, and every review round SHALL review the whole pull request, from the merge base of the head and the base branch.

The Change of the pull request SHALL be the one directory under `openspec/changes/` (archived or not) holding a `proposal.md` that the range adds or changes; with none or several, the review SHALL have no Change. The lead SHALL record the groups with `bdk git groups <range base> --record <round dir>`, run in the worktree, adding `--plan <change>/plan/parts` when the Change has plan parts; the range base SHALL be `origin/<base>` in a review round. It SHALL then start one `bdk:reviewer` per group except `integration`, at most `execution.max-parallel` at once as foreground `Agent` calls in one message; then one `bdk:integration-reviewer`; then one `bdk:judge`; each with the round directory, `--workdir <worktree>`, `--change <change>|none` and `--intent <run dir>/pr.md`, and `model` set from `models.<role>` when the configuration sets it. It SHALL run no check and no E2E.

After the judge, the lead SHALL remove the worktree and write `<run dir>/result.md`, starting with `Status: done` or `Status: blocked`, naming the mode (`review` or `verify`), the round directory, the pull request's range (from the merge base), the head commit and the Change, and on `blocked` a `## Blockers` section with the reason. A review round whose range has no changed text file SHALL be `Status: done` with no round of reviewers and the line `No changes to review.`

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

### Requirement: Verify mode

`/bdk:pr-review --verify <pr>` SHALL re-check the previous review of the current user (`gh api user`): the newest review by that user whose body holds `bdk-pr-review v3 kind=summary` or `kind=verify-summary`, read with one `gh api graphql` query for the pull request's reviews and review threads. The findings to check SHALL be each unresolved thread whose first comment is that user's and holds `bdk-pr-review v3 kind=finding` with level `blocker` or `should-fix`, and each `blocker` or `should-fix` line of that review's section of findings outside the diff, or, of a verify review, of its left findings without a thread; it SHALL write them to `<run dir>/previous.json` with the thread id (or none), file, line, level, summary and evidence. Without a previous review, or with no finding to check, it SHALL start nothing and say so. It SHALL start the lead with `--verify` and `--since <sha>`, the `head=` of the previous review's marker, when the marker has one.

The lead, started with `--verify`, SHALL fetch and make the worktree as in a review round, add each finding of `previous.json` to the new round's log with `bdk findings add --source previous-review` before any reviewer starts, and record each finding's id next to its thread in `<round dir>/previous.json`. It SHALL then review the commits added since the previous review as a review round does (groups, reviewers, the integration reviewer, the judge), with the range base `<since>` when `<since>` is an ancestor of the head commit, and `origin/<base>` (the whole pull request) when it is not, when git does not know it, or without `--since`. When that range has no changed text file, it SHALL start no reviewer and only the judge. One judge SHALL level the previous and the new findings in the same round. `result.md` SHALL name the reviewed range on a `Reviewed:` line. A previous finding the judge levels `not-a-problem` SHALL count as fixed; any other level as left. A finding of the round whose source is not `previous-review` SHALL be a new finding.

The main thread SHALL render one review from the verify template: the fixed and the left previous findings with the judge's reasons; each new `blocker` and `should-fix` finding whose line is inside a hunk of the pull request's diff as an inline comment with the finding marker, the other new `blocker` and `should-fix` findings in the section outside the diff, and each new `nice-to-have` finding in the summary; which commits were reviewed (those since the previous head, or the whole pull request); each left finding without a thread marked so that the next verification finds it; the verdict `request-changes` when a left previous finding or a new finding is `blocker` and `approve` otherwise; and the marker `bdk-pr-review v3 kind=verify-summary verdict=<v> head=<sha>`. It SHALL confirm and post it under the requirement "Confirmation and posting", and only after the review was posted SHALL it resolve the thread of each fixed finding with the `resolveReviewThread` mutation, and no other thread.

#### Scenario: One blocker fixed

- **WHEN** the previous review of pull request 7 has `blocker` threads on `src/parse.js` and `src/report.js`, a new head commit fixes only the parse bug, and the user asked to post without asking
- **THEN** one review is posted with the event `REQUEST_CHANGES` that lists the parse finding as fixed and the report finding as left, and then only the `src/parse.js` thread is resolved

#### Scenario: Fix commit adds a new blocker

- **WHEN** the previous review of pull request 7 has `blocker` threads on `src/parse.js` and `src/report.js`, the new commits fix both, one of them makes the report sum only the last entry of each month, and the user asked to post without asking
- **THEN** reviewers run on the commits since the previous head, one review is posted with the event `REQUEST_CHANGES` and an inline comment on `src/report.js` holding `bdk-pr-review v3 kind=finding`, and both previous threads are resolved

#### Scenario: Force-pushed pull request

- **WHEN** `/bdk:pr-review --verify 7` runs and the previous review's head is not an ancestor of the current head
- **THEN** the lead records the groups from `origin/<base>` and the verify review says the whole pull request was reviewed

#### Scenario: No new commit

- **WHEN** the previous review's head is the current head
- **THEN** no `bdk:reviewer` starts and one `bdk:judge` levels the previous findings

#### Scenario: Nothing to verify

- **WHEN** `/bdk:pr-review --verify 7` runs and the current user posted no review with the marker on pull request 7
- **THEN** no agent starts, nothing is posted, and the reply names `/bdk:pr-review 7`

#### Scenario: Not posted, nothing resolved

- **WHEN** a verify review is computed and the user chooses not to post it
- **THEN** no review is posted and no thread is resolved

### Requirement: Eval cases of the PR review

The suite SHALL hold the orchestrator cases `pr-review-post` and `pr-review-confirm` on a shared fixture `monthly-report-pr`: the `monthly-report` project with its two seeded bugs pushed as pull request 7 of a bare `origin` inside the workspace, the user's checkout on `main`, and the offline `gh` stand-in. `pr-review-post` SHALL grade that one review was posted with `REQUEST_CHANGES` and inline comments on the parse bug and the cents and dollars seam, that the round report exists, and that the user's checkout stayed on `main`. `pr-review-confirm` SHALL grade that no review was posted and that the reply asks for the verdict.

It SHALL also hold `pr-review-verify` on the fixture `monthly-report-pr-reviewed`, which adds to `monthly-report-pr` a recorded review of pull request 7 by the eval user with the summary marker and inline `blocker` threads on the parse bug and on the cents and dollars seam, and a new head commit that fixes only the parse bug; it SHALL grade that only the parse thread is resolved and that a second review with `REQUEST_CHANGES` and the verify marker is posted. It SHALL hold `pr-review-verify-regression` on the fixture `monthly-report-pr-regressed`, which adds to `monthly-report-pr-reviewed` a commit that fixes the cents and dollars seam and makes the report keep only the last entry of each month; it SHALL grade that both previous threads are resolved, that the verify review requests changes with an inline finding comment on `src/report.js`, and that reviewers ran. And it SHALL hold `pr-review-several` on the fixture `monthly-report-two-prs`, which adds a correct pull request 8; it SHALL grade that both reviews are posted, `REQUEST_CHANGES` on 7 and `APPROVE` on 8, from two `bdk:lead` agents.

#### Scenario: Fixture pull request reviewed

- **WHEN** `pr-review-post` runs with the plugin
- **THEN** `.git/bdk-eval/reviews/7-1.json` holds the event `REQUEST_CHANGES` and inline comments on `src/parse.js` and on the report code, and `.bdk/runs/pr-7/review/round-1/review.md` exists

#### Scenario: Fixed blocker verified

- **WHEN** `pr-review-verify` runs with the plugin
- **THEN** `.git/bdk-eval/resolved.json` lists the thread of the `src/parse.js` comment and no other, and `.git/bdk-eval/reviews/7-2.json` holds the event `REQUEST_CHANGES` and `kind=verify-summary`

#### Scenario: New blocker of a fix commit verified

- **WHEN** `pr-review-verify-regression` runs with the plugin
- **THEN** `.git/bdk-eval/resolved.json` lists both previous threads, and `.git/bdk-eval/reviews/7-2.json` holds the event `REQUEST_CHANGES`, `kind=verify-summary` and an inline comment on `src/report.js`

#### Scenario: Two pull requests reviewed

- **WHEN** `pr-review-several` runs with the plugin
- **THEN** `.git/bdk-eval/reviews/7-1.json` holds `REQUEST_CHANGES` and `.git/bdk-eval/reviews/8-1.json` holds `APPROVE`

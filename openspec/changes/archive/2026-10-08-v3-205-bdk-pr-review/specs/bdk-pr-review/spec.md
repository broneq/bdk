# Spec Delta

## Purpose

Defines the PR review of the `bdk` plugin: the thin orchestrator `/bdk:pr-review`, which starts one `bdk:lead` agent that reviews a GitHub pull request with the review blocks, and turns the judged findings into one GitHub review that is posted only after the user confirms it.

## ADDED Requirements

### Requirement: Skills and agent

The `bdk` plugin SHALL ship the skills `pr-review` (`skills/pr-review/`, the user command `/bdk:pr-review`) and `pr-review-round` (`skills/pr-review-round/`, not user-invocable). `/bdk:pr-review` SHALL start one `bdk:lead` agent whose prompt names the skill `bdk:pr-review-round` and the arguments `<number> --run-dir <absolute .bdk/runs/pr-<number>>`; it SHALL start no reviewer itself and edit no project file. `pr-review-round` SHALL run only on `bdk:lead`; started anywhere else it SHALL do nothing and name `/bdk:pr-review`.

#### Scenario: Lead started with its skill

- **WHEN** `/bdk:pr-review https://github.com/bdk-eval/repo/pull/7` runs in a configured project whose repository is `bdk-eval/repo`
- **THEN** the main conversation starts one `bdk:lead` agent whose prompt names `bdk:pr-review-round` and `7 --run-dir <absolute .bdk/runs/pr-7>`, and starts no `bdk:reviewer` itself

### Requirement: Start of a PR review

`/bdk:pr-review [<pr-url> | <number>]` SHALL get the configuration from its own `bdk config show` block and, in a project that is not configured or whose configuration is invalid, stop with the line that command prints. Without an argument it SHALL take the pull request of the current branch. It SHALL read the pull request with `gh pr view` and stop, starting nothing, when there is none, when its state is not `OPEN`, or when its repository is not the repository of the working directory (`gh repo view`). It SHALL write the brief `.bdk/runs/pr-<number>/pr.md`, holding the number, URL, title, author, draft state, base branch, head branch, head commit, description and linked issues, and start the lead in the background when `execution.lead` is `background` and in the foreground when it is `foreground`, with `model` set to `models.lead` when the configuration sets it.

#### Scenario: Closed pull request

- **WHEN** `/bdk:pr-review 7` runs and pull request 7 is `MERGED`
- **THEN** no agent starts, nothing is posted, and the reply says the pull request is not open

#### Scenario: Pull request of another repository

- **WHEN** `/bdk:pr-review https://github.com/other/repo/pull/3` runs in a project whose repository is `bdk-eval/repo`
- **THEN** no agent starts and the reply says to run the review in a checkout of `other/repo`

### Requirement: Review round of a pull request

`pr-review-round` SHALL fetch the pull request's head (`pull/<number>/head`) and its base branch from `origin`, and SHALL stop with `Status: blocked` when the fetched head is not the head commit of the brief. It SHALL review the head in a detached git worktree `<run dir>/worktree`, made fresh for every run, and SHALL leave the user's checkout, branch and index unchanged. The round directory SHALL be `<run dir>/review/round-<N>/` with the lowest `N` whose directory holds no `report.md`, and every round SHALL review the whole pull request, from the merge base of the head and the base branch.

The Change of the pull request SHALL be the one directory under `openspec/changes/` (archived or not) holding a `proposal.md` that the range adds or changes; with none or several, the review SHALL have no Change. The lead SHALL record the groups with `bdk git groups origin/<base> --record <round dir>`, run in the worktree, adding `--plan <change>/plan/parts` when the Change has plan parts. It SHALL then start one `bdk:reviewer` per group except `integration`, at most `execution.max-parallel` at once as foreground `Agent` calls in one message; then one `bdk:integration-reviewer`; then one `bdk:judge`; each with the round directory, `--workdir <worktree>`, `--change <change>|none` and `--intent <run dir>/pr.md`, and `model` set from `models.<role>` when the configuration sets it. It SHALL run no check and no E2E.

After the judge, the lead SHALL remove the worktree and write `<run dir>/result.md`, starting with `Status: done` or `Status: blocked`, naming the round directory, the range, the head commit and the Change, and on `blocked` a `## Blockers` section with the reason. A range with no changed text file SHALL be `Status: done` with no round of reviewers and the line `No changes to review.`

#### Scenario: Two-part Change as a pull request

- **WHEN** the lead runs on pull request 7, whose head carries the Change `monthly-report` with plan parts `01` and `02`
- **THEN** `round-1/groups.json` holds the groups `p01`, `p02`, `unplanned` and `integration`, three `bdk:reviewer` agents start in one message before the integration reviewer, the judge writes `round-1/report.md`, and `result.md` starts with `Status: done`

#### Scenario: User's checkout untouched

- **WHEN** the user's checkout is on `main` with an uncommitted file and the lead reviews pull request 7
- **THEN** after the run the checkout is still on `main` with the same uncommitted file, and `git worktree list` no longer lists `<run dir>/worktree`

#### Scenario: Head moved

- **WHEN** the head fetched from `pull/7/head` is not the head commit written in the brief
- **THEN** no reviewer starts and `result.md` starts with `Status: blocked` naming both commits

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

Nothing SHALL reach GitHub before the user confirms it, except when `policy.questions` is `decide-and-record` or the user's request says to post without asking; then the computed verdict SHALL be posted and the reply SHALL say that it was posted without a question. With `policy.questions: stop` (the default) it SHALL ask with `AskUserQuestion` whether to post with the computed verdict (recommended), post with the other verdict, post as a comment, or not post; when that tool is not available it SHALL put the question at the end of the reply and stop without posting.

It SHALL post exactly one review per run with `gh api repos/<owner>/<repo>/pulls/<number>/reviews -X POST --input <file>`, holding the head commit, the event, the summary and the inline comments, from a file written under the run directory. On the user's own pull request (`gh api user` is the author) the event SHALL be `COMMENT`. When GitHub rejects an inline comment's place, it SHALL move the inline comments into the summary and post once more, never the same payload twice. The reply SHALL name the posted review's URL and the verdict.

#### Scenario: Posted on request

- **WHEN** the user asked to review pull request 7 and post the review without asking, and the round holds blockers
- **THEN** one review is posted with the event `REQUEST_CHANGES`, and the reply says it was posted without a question

#### Scenario: Nothing posted without the user

- **WHEN** `/bdk:pr-review 7` runs with `policy.questions: stop` in a session without `AskUserQuestion`
- **THEN** no `gh api .../reviews` call runs and the reply ends with the question which verdict to post

#### Scenario: Own pull request

- **WHEN** the author of pull request 7 is the user `gh api user` names and the user confirms `request-changes`
- **THEN** the review is posted with the event `COMMENT` and the summary states the verdict

### Requirement: Eval cases of the PR review

The suite SHALL hold the orchestrator cases `pr-review-post` and `pr-review-confirm` on a shared fixture `monthly-report-pr`: the `monthly-report` project with its two seeded bugs pushed as pull request 7 of a bare `origin` inside the workspace, the user's checkout on `main`, and the offline `gh` stand-in. `pr-review-post` SHALL grade that one review was posted with `REQUEST_CHANGES` and inline comments on the parse bug and the cents and dollars seam, that the round report exists, and that the user's checkout stayed on `main`. `pr-review-confirm` SHALL grade that no review was posted and that the reply asks for the verdict.

#### Scenario: Fixture pull request reviewed

- **WHEN** `pr-review-post` runs with the plugin
- **THEN** `.git/bdk-eval/reviews/7-1.json` holds the event `REQUEST_CHANGES` and inline comments on `src/parse.js` and on the report code, and `.bdk/runs/pr-7/review/round-1/report.md` exists

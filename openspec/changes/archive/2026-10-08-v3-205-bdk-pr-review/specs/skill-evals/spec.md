## MODIFIED Requirements

### Requirement: Offline gh stand-in

The suite SHALL ship an executable `plugins/bdk/evals/fixtures/bin/gh` that stands in for the GitHub CLI in eval runs, which have their own `HOME` and no GitHub credential. It SHALL answer `gh issue view <ref>` from the file `.git/bdk-eval/issues/<n>.json` of the git repository around the working directory, where `<n>` is the issue number of `<ref>` (`<n>`, `#<n>`, `<owner>/<repo>#<n>` or an issue URL), and SHALL accept `--repo`. With `--json <fields>` it SHALL print one JSON object holding only those fields; without it, the title, state and body as text. For an issue with no file it SHALL exit 1 with the message `GraphQL: Could not resolve to an issue or pull request with the number of <n>.`

It SHALL also answer pull requests from the directory `.git/bdk-eval/prs/`:

- `gh pr create --base <base> --head <head> --title <title> (--body <text> | --body-file <path>)` SHALL write the next file `<n>.json` (numbers from 1) holding `number`, `url` (`https://github.com/bdk-eval/repo/pull/<n>`), `state` `OPEN`, `baseRefName`, `headRefName`, `title` and `body`, and print the URL. A missing `--base`, `--head` or `--title`, a body file that cannot be read, or an open pull request with the same head SHALL exit 1 with a message.
- `gh pr view <head> [--json <fields>]` SHALL print the open pull request whose `headRefName` is `<head>` (as for issues, only the fields asked with `--json`), and SHALL exit 1 with `no pull requests found for branch "<head>"` when there is none.
- `gh pr view <n> | <pr-url> [--json <fields>]` SHALL print the pull request of the file `<n>.json`, whatever its state, and SHALL exit 1 with `GraphQL: Could not resolve to a PullRequest with the number of <n>.` when there is none. Fields a scaffold wrote (`isDraft`, `author`, `headRefOid`, `closingIssuesReferences` and others) SHALL be printed as written.
- `gh repo view [--json <fields>]` SHALL print the repository `bdk-eval/repo` (`nameWithOwner`, `url` `https://github.com/bdk-eval/repo`, `defaultBranchRef` `{"name": "main"}`).
- `gh api user` SHALL print `{"login": "bdk-eval-user"}`.
- `gh api repos/<owner>/<repo>/pulls/<n>/reviews -X POST --input <file>` (`--method POST` too) SHALL, for an existing pull request `<n>`, copy the JSON of `<file>` to the next file `.git/bdk-eval/reviews/<n>-<k>.json` (`k` from 1) and print `{"id": <k>, "html_url": "https://github.com/bdk-eval/repo/pull/<n>#pullrequestreview-<k>", "state": <state of the event>}`. Input that is not JSON, or has no `event` or no `body`, SHALL exit 1 with a message holding `HTTP 422`, as gh does, and a pull request without a file SHALL exit 1 with a message holding `HTTP 404`.

Every other command SHALL exit 1 naming the stand-in, and it SHALL never reach the network. A case that uses the stand-in SHALL, from its scaffold, write its issue files and copy the stand-in to `.git/bdk-eval/bin/gh` of the workspace, because a run cannot execute a file outside its workspace; `plugins/bdk/evals/README.md` SHALL show the run command that puts the relative directory `.git/bdk-eval/bin` first on `PATH`.

#### Scenario: Issue from the scaffold

- **WHEN** a scaffold has written `.git/bdk-eval/issues/42.json` and `gh issue view '#42' --json number,title` runs the stand-in in the workspace
- **THEN** stdout is a JSON object with exactly the keys `number` and `title` from that file, and the exit code is 0

#### Scenario: Unknown issue

- **WHEN** `gh issue view 7` runs in a workspace with no `.git/bdk-eval/issues/7.json`
- **THEN** the exit code is 1 and stderr says `GraphQL: Could not resolve to an issue or pull request with the number of 7.`

#### Scenario: Pull request recorded

- **WHEN** `gh pr create --base main --head add-total --title "feat: tally total" --body-file body.md` runs the stand-in in a workspace without pull requests
- **THEN** `.git/bdk-eval/prs/1.json` holds `baseRefName` `main`, `headRefName` `add-total` and the body of `body.md`, stdout is `https://github.com/bdk-eval/repo/pull/1`, and the exit code is 0

#### Scenario: Pull request of a branch

- **WHEN** `gh pr view add-total --json url,state` runs after that pull request was created
- **THEN** stdout is a JSON object with exactly the keys `state` and `url`, and the exit code is 0

#### Scenario: No pull request for the branch

- **WHEN** `gh pr view add-total` runs in a workspace without pull requests
- **THEN** the exit code is 1 and stderr says `no pull requests found for branch "add-total"`


#### Scenario: Pull request by number

- **WHEN** a scaffold has written `.git/bdk-eval/prs/7.json` with `headRefOid` and `gh pr view https://github.com/bdk-eval/repo/pull/7 --json number,headRefOid` runs the stand-in
- **THEN** stdout is a JSON object with exactly the keys `headRefOid` and `number` from that file, and the exit code is 0

#### Scenario: Review recorded

- **WHEN** `gh api repos/bdk-eval/repo/pulls/7/reviews -X POST --input review.json` runs with a `review.json` holding `event` `REQUEST_CHANGES` and a `body`
- **THEN** `.git/bdk-eval/reviews/7-1.json` holds the JSON of `review.json`, stdout names the review id 1 and the state `CHANGES_REQUESTED`, and the exit code is 0

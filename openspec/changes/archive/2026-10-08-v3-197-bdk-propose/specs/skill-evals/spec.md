## ADDED Requirements

### Requirement: Offline gh stand-in

The suite SHALL ship an executable `plugins/bdk/evals/fixtures/bin/gh` that stands in for the GitHub CLI in eval runs, which have their own `HOME` and no GitHub credential. It SHALL answer `gh issue view <ref>` from the file `.git/bdk-eval/issues/<n>.json` of the git repository around the working directory, where `<n>` is the issue number of `<ref>` (`<n>`, `#<n>`, `<owner>/<repo>#<n>` or an issue URL), and SHALL accept `--repo`. With `--json <fields>` it SHALL print one JSON object holding only those fields; without it, the title, state and body as text. For an issue with no file it SHALL exit 1 with the message `GraphQL: Could not resolve to an issue or pull request with the number of <n>.`; every other command SHALL exit 1 naming the stand-in, and it SHALL never reach the network. A case that reads issues SHALL, from its scaffold, write its issue files and copy the stand-in to `.git/bdk-eval/bin/gh` of the workspace, because a run cannot execute a file outside its workspace; `plugins/bdk/evals/README.md` SHALL show the run command that puts the relative directory `.git/bdk-eval/bin` first on `PATH`.

#### Scenario: Issue from the scaffold

- **WHEN** a scaffold has written `.git/bdk-eval/issues/42.json` and `gh issue view '#42' --json number,title` runs the stand-in in the workspace
- **THEN** stdout is a JSON object with exactly the keys `number` and `title` from that file, and the exit code is 0

#### Scenario: Unknown issue

- **WHEN** `gh issue view 7` runs in a workspace with no `.git/bdk-eval/issues/7.json`
- **THEN** the exit code is 1 and stderr says `GraphQL: Could not resolve to an issue or pull request with the number of 7.`

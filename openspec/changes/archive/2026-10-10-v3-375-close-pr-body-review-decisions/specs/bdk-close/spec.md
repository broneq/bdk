## MODIFIED Requirements

### Requirement: Pull request into the base branch

The skill SHALL push the branch with `git push -u origin <branch>` and SHALL NOT pass `--force` or `--force-with-lease`. It SHALL then run `gh pr view <branch> --json url,state`: an open pull request of the branch SHALL be reused; otherwise it SHALL run `gh pr create --base <base> --head <branch> --title <title> --body-file .bdk/runs/<change>/close/pr-body.md`. The title SHALL follow the project's commit convention and say what the Change does. The body SHALL hold what the Change does, `Resolves #<n>` when the issue is known (the `issue` of the Change in `run.json`, or the issue the first line under Why of `proposal.md` names), the capabilities whose main specs changed, the spec-conformance verdict, the E2E verdict or that no E2E results exist, the number of review rounds or that no review round ran, and every decision taken without the user (the bullets of `## Decided without the user` of `proposal.md`, the `Decided without the user:` lines of `design.md`, and the bullets of `## Decisions taken without the user` of `review/result.md`, auto triage lines included, each group named by its source; a `- None.` bullet or a missing file adds nothing), or that there were none. When the push or `gh` fails, the skill SHALL stop, quote the error, and write no `close/pr.md`; the archive and its commit stay.

#### Scenario: Pull request body

- **WHEN** the close of `add-total` creates its pull request
- **THEN** `gh pr create` runs with `--base main`, and the body file names the capability `tally`, `Verdict: PASS` of spec conformance and the E2E verdict

#### Scenario: No remote

- **WHEN** the repository has no remote `origin`
- **THEN** the Change stays archived and committed, no `close/pr.md` is written, and the reply quotes the `git push` error and says that the push and pull request remain

#### Scenario: Existing pull request

- **WHEN** `gh pr view add-total --json url,state` reports an open pull request
- **THEN** the skill pushes without force, runs no `gh pr create`, and records that pull request's URL

#### Scenario: Review decisions in the pull request body

- **WHEN** the close of `add-total` creates its pull request and `review/result.md` lists under `## Decisions taken without the user` the line `Round 1: triage by policy.gates.review auto.` and a product decision of the fix pass
- **THEN** the decisions part of the body file holds both lines, named as the review's, and does not read `none`

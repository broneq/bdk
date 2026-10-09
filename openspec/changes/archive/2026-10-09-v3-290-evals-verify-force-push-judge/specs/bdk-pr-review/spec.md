## MODIFIED Requirements

### Requirement: Eval cases of the PR review

The suite SHALL hold the orchestrator cases `pr-review-post` and `pr-review-confirm` on a shared fixture `monthly-report-pr`: the `monthly-report` project with its two seeded bugs pushed as pull request 7 of a bare `origin` inside the workspace, the user's checkout on `main`, and the offline `gh` stand-in. `pr-review-post` SHALL grade that one review was posted with `REQUEST_CHANGES` and inline comments on the parse bug and the cents and dollars seam, that the round report exists, and that the user's checkout stayed on `main`. `pr-review-confirm` SHALL grade that no review was posted and that the reply asks for the verdict.

It SHALL also hold `pr-review-verify` on the fixture `monthly-report-pr-reviewed`, which adds to `monthly-report-pr` a recorded review of pull request 7 by the eval user with the summary marker and inline `blocker` threads on the parse bug and on the cents and dollars seam, and a new head commit that fixes only the parse bug; it SHALL grade that only the parse thread is resolved and that a second review with `REQUEST_CHANGES` and the verify marker is posted. It SHALL hold `pr-review-verify-regression` on the fixture `monthly-report-pr-regressed`, which adds to `monthly-report-pr-reviewed` a commit that fixes the cents and dollars seam and makes the report keep only the last entry of each month; it SHALL grade that both previous threads are resolved, that the verify review requests changes with an inline finding comment on `src/report.js`, and that reviewers ran. It SHALL hold `pr-review-verify-force-push` on the fixture `monthly-report-pr-force-pushed`, which squashes the pull request of `monthly-report-pr-reviewed` into one commit on its merge base and force-pushes it, so the previous review's head is not an ancestor of the head; it SHALL grade that `round-1/groups.json` holds the Change's proposal (the range starts at the merge base), that the verify review says the whole pull request was reviewed and requests changes, and that only the parse thread is resolved. It SHALL hold `pr-review-verify-no-new-commit` on the fixture `monthly-report-pr-verified`, which adds to `monthly-report-pr-reviewed` a verify review of the eval user at the current head with the parse thread resolved; it SHALL grade that `round-1/groups.json` holds no group, that no `bdk:reviewer` and no `bdk:integration-reviewer` starts, that a `bdk:judge` levels the left report finding `blocker`, and that the verify review requests changes and says there were no new commits. And it SHALL hold `pr-review-several` on the fixture `monthly-report-two-prs`, which adds a correct pull request 8; it SHALL grade that both reviews are posted, `REQUEST_CHANGES` on 7 and `APPROVE` on 8, from two `bdk:lead` agents.

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

#### Scenario: Force-pushed pull request verified

- **WHEN** `pr-review-verify-force-push` runs with the plugin
- **THEN** `.bdk/runs/pr-7/review/round-1/groups.json` names `openspec/changes/monthly-report/proposal.md`, `.git/bdk-eval/reviews/7-2.json` holds `REQUEST_CHANGES`, `kind=verify-summary` and "the whole pull request", and `.git/bdk-eval/resolved.json` lists the parse thread and not the report thread

#### Scenario: Verify with no new commit

- **WHEN** `pr-review-verify-no-new-commit` runs with the plugin
- **THEN** `.bdk/runs/pr-7/review/round-1/groups.json` holds no group, no Agent call starts `bdk:reviewer` or `bdk:integration-reviewer`, a `bdk:judge` levels a finding `blocker`, and `.git/bdk-eval/reviews/7-3.json` holds `REQUEST_CHANGES`, `kind=verify-summary` and "no new commits"

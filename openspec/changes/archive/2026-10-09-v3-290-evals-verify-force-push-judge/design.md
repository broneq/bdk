# Design

## Context

Input: issue #290, the archived Change `2026-10-09-v3-280-pr-review-verify-new-commits` (design D1, D3, D6), the fixtures `monthly-report-pr-reviewed.sh` and `monthly-report-pr-regressed.sh`, the judge cases on `monthly-report.sh` (`judge-levels`), and the eval setup of #189 (`plugins/bdk/evals/README.md`). This Change adds eval coverage only (CLAUDE.md "Building skills (v3)": each block has its own eval cases).

## Goals / Non-Goals

**Goals:** one case per untested verify-round branch, each passing 3 of 3 runs with `--ablation none`.

**Non-Goals:** changing a skill. If a case fails, the cause goes to its own fix in this Change only when it is a defect of the skill text; a grader that reads the wrong thing is fixed in the grader.

## Decisions

### D1. Force-push fixture: squash on the merge base

`monthly-report-pr-force-pushed.sh` runs `monthly-report-pr-reviewed.sh`, then resets the pull request's head softly onto its merge base with `main` and commits the tree as one commit, force-pushed to `monthly-report` and `refs/pull/7/head`. The reviewed head (the `head=` of review 1) stays in the object store, so `git merge-base --is-ancestor` exits 1 (not 128): the case covers the force-push branch itself, not the unknown-commit branch. The tree equals the parse-fix head, so the expected verify outcome matches `pr-review-verify` (parse thread resolved, report thread open, `REQUEST_CHANGES`) and only the range differs.

Alternatives: rebase onto a new `main` commit - lost: it also changes the base and the merge base, adding a second variable to the case. Amend only the fix commit - lost: the reviewed head would stay an ancestor.

### D2. No-new-commit fixture: a first verify review at the head

`monthly-report-pr-verified.sh` records review 2 as the verify review `/bdk:pr-review --verify` would post on `monthly-report-pr-reviewed` (from `references/comment-templates.md`, "Verify summary": parse fixed, report left with its thread), at the current head, and marks thread `PRRT_7_1_1` resolved. The newest review of the user then names the current head, so the round has nothing new to review, and only the report thread is left to verify. This is the real sequence (verify, the author pushes nothing, verify again) and also covers reading a `kind=verify-summary` review as the previous one.

Alternatives: rewrite review 1's head to the current head - lost: a review of a head that already holds the parse fix would not have flagged it, so the fixture would be self-contradictory.

### D3. Graders

- Force-push: `groups.json` holds `openspec/changes/monthly-report/proposal.md` (the inverse of `delta-only` in `pr-review-verify`), and `7-2.json` holds `Reviewed the whole pull request` (the template's wording), plus the outcome graders of `pr-review-verify`.
- No new commit: `groups.json` holds `"groups": []`; a `tool_used` grader with `max: 0` on Agent calls naming `bdk:reviewer` or `bdk:integration-reviewer` (tool calls of the lead count, as in `auto-review-first-round`'s `workers-foreground`); a `bdk:judge` Agent call; a `blocker` level line in the round's log; `7-3.json` with `REQUEST_CHANGES`, the verify marker and `Reviewed no new commits`; `PRRT_7_1_2` not resolved; `previous.json` without `src/parse.js`.
- Judge: the seeded id's level line `blocker`, the later id's level line `not-a-problem` whose `reason` names the seeded id, and a guard that the seeded id is never `not-a-problem`. The two findings are worded differently (the seeded one as the GitHub thread states it, the later one as a reviewer would), so the judge must see the repeat, not match text.

### D4. Arms

The issue's acceptance signal is `--ablation none`. The judge case is tagged `block` like `judge-levels`; its with/without comparison is not part of this acceptance signal.

## Risks / Trade-offs

- [Orchestrator cases cost about $1 and 4 minutes per run] -> run only on demand, as the other `pr-review-*` cases.
- [On the force-pushed range, the reviewers report the report bug again] -> the judge's earlier-of-two rule keeps the seeded finding; the case grades the thread stays open.

## Measurements

Claude Code 2.1.295, macOS, clean `HOME` and the git shell prefix of the eval README "Host limits"; `claude plugin eval --ablation none --runs 3 -j 3`.

| Case | Score | Cost per run | Wall clock (3 runs) |
|---|---|---|---|
| `judge-previous-repeat` | 1.00 (6/6 graders in each run) | $0.25 to $0.29 | 26 s |
| `pr-review-verify-force-push` | 1.00 (13/13: range from the merge base, "Reviewed the whole pull request", only `PRRT_7_1_1` resolved, `REQUEST_CHANGES`) | $1.13 to $1.24 | 210 s |
| `pr-review-verify-no-new-commit` | 1.00 (15/15: empty groups, no reviewer started, one judge, "Reviewed no new commits", `REQUEST_CHANGES`) | $0.62 to $0.64 | 106 s |

No skill needed a change. A verify with no new commit costs about $0.63, against about $0.99 for a verify of a one-commit delta (#280): the judge-only path of D6 holds.

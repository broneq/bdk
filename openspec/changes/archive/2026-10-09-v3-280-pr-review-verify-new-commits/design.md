# Design

## Context

See proposal.md for why. What this Change builds on:

- #256 (archived Change `2026-10-08-v3-256-pr-review-verify-multi`): the main thread reads the previous review from GitHub (D2) and writes `<run dir>/previous.json`; the lead seeds those findings into a round's log with `bdk findings add --source previous-review` and runs only the judge (D1, D4); the verify template and the resolve-after-post rule (D5). D3 left out the review of the new commits, for scope and speed; this Change adds it.
- #205 (archived Change `2026-10-08-v3-205-bdk-pr-review`): the review round of the lead (groups, a reviewer per group, the integration reviewer, the judge, D2), the render rules and markers (D7), the confirmation (D8).
- #186 (spec `bdk-cli/git`): `bdk git groups <base> [--record <dir>]` reviews `<merge base of base and HEAD>..HEAD`; the anchor of kind `base` carries that merge base.
- The judge (#193, spec `review-blocks`): `not-a-problem` covers a finding that repeats another, with that id in the reason.
- Architecture: D1 (hybrid; a lead per long mechanical stage), ADR-0003 principles 2 (one block, one job) and 7 (plain skill first).

## Goals / Non-Goals

**Goals:**

- A verify round reviews the commits added since the previous review with the same review blocks as a review round, and the judge levels previous and new findings together.
- New `blocker` and `should-fix` findings reach the verify review as inline comments and count in its verdict.
- An eval case where a fix commit fixes the previous blockers and adds a new one.

**Non-Goals:**

- A CLI helper for the delta range (D1).
- Reviewing the commits of another reviewer's review, or of a review without a head in its marker (then the whole pull request is reviewed, D1).

## Decisions

### D1. The delta range is `bdk git groups <since>`

The lead runs `git -C <worktree> merge-base --is-ancestor <since> <head commit>`. Exit 0: the range base is `<since>`, and `bdk git groups <since> --record <round dir>` (with `--plan` as in a review round) records `<since>..<head>`, because the merge base of an ancestor and the head is the ancestor itself. Any other exit (not an ancestor after a force-push or rebase, or a commit the fetch did not bring, which git reports as exit 128): the range base is `origin/<base>`, the whole pull request, as in a review round. Without `--since` (the previous marker has no head) the same.

Alternatives: `bdk git groups --rounds <run dir>/review`, whose anchor is the last finished round's recorded head - lost: the previous review is read from GitHub, not from the local rounds (#256 D2), a verify round of #256 recorded no `groups.json`, and another machine's review has no local round at all. A new `bdk git groups --since <sha>` flag with its own anchor kind - lost: the existing command already gives that range, and no eval showed a problem a flag would solve (CLAUDE.md "Building skills (v3)"); the reviewers see an anchor of kind `base` and review the range they are given.

### D2. The previous head reaches the lead as `--since <sha>`

`/bdk:pr-review` already keeps the `head=` of the previous review's marker (step 2 of #256). It passes it to the lead in the prompt: `<number> --run-dir <dir> --verify --since <sha>`. `result.md` of a verify round names the reviewed range on a `Reviewed:` line; `Range:` stays the pull request's range (merge base to head), which the main thread needs to place inline comments.

Alternatives: a line in the brief `pr.md` - lost: the brief is the reviewers' `--intent`, what the author meant, and the previous review's head is not part of it. Wrap `previous.json` in an object with the head - lost: it changes a format two skills share for one value the prompt carries.

### D3. Seed first, review, then one judge; the judge keeps the earlier of two repeating findings

The lead seeds the previous findings before any reviewer starts, then runs the reviewers and the integration reviewer on the delta, then one judge. The integration reviewer reads the log and does not repeat a previous finding (spec `review-blocks`). A group reviewer does not read the log, and may report an unfixed previous finding again. If the judge then leveled the previous finding `not-a-problem` as the repeat, the main thread would call it fixed and resolve its thread. The judge's rule becomes: of two findings that repeat each other, the later in the log is `not-a-problem`, naming the earlier id. Seeded findings come first, so a previous finding is never the repeat of a new one.

Alternatives: the main thread reads the judge's reasons and treats a previous finding that names a new id as left - lost: it parses free text, and the main thread would interpret levels (#256 D4: it does not). Tell the group reviewers the previous findings - lost: a second input for `review-group` and its evals, for what one sentence of the judge fixes for every caller (a group and the integration reviewer can repeat each other in a review round too).

### D4. New findings in the verify review

A new finding is one whose source is not `previous-review`. The main thread renders them as a review round does (#205 D7): `blocker` and `should-fix` inside a hunk of `git diff <Range>` are inline comments with the finding marker, others go to "Outside the diff", `nice-to-have` to "Nice to have", `not-a-problem` nowhere. Inline placement uses the pull request's range, not the reviewed delta: GitHub places review comments on the pull request's diff. Verdict: `request-changes` when a left previous finding or a new finding is `blocker`, else `approve`. The payload carries the inline comments; the verify summary marker stays `kind=verify-summary`, so the next `--verify` finds this review, and its new inline threads carry `kind=finding`, so the next verify checks them too.

### D5. The verify template says what was reviewed

The note "were checked only against these findings" goes. The first line says which commits were reviewed: "the commits since `<since>`" when the range base was `<since>`, "the whole pull request (`<since>` is no longer in its history)" after a force-push, and the counts of new findings. Sections: Left, Fixed, then the review sections Blocking, Should fix, Outside the diff, Nice to have for the new findings.

### D6. No new commit

When the previous head is the current head, `groups.json` holds no group: the lead starts no reviewer and runs the judge on the seeded findings, as #256 did. `result.md` stays `Status: done`; the main thread renders "no new commits" in the summary.

### D7. Eval fixture: a fix that adds a defect

`monthly-report-pr-regressed.sh` starts from `monthly-report-pr-reviewed.sh` (the parse fix on top of the reviewed head) and adds one commit "fix(report): totals in currency units": `monthlyTotals` turns cents into currency units, which fixes the report blocker, but it now sets each month's total to the month's last entry instead of adding to it; its rewritten test has one entry per month, so every test passes. The scenario "Totals per month" prints `2026-01 2.25` instead of `2026-01 14.75`. The case `pr-review-verify-regression` grades: both previous threads resolved, `7-2.json` `REQUEST_CHANGES` with the verify marker and an inline comment on `src/report.js` holding `kind=finding`, no "checked only against" note, and `bdk:reviewer` agents started.

Alternatives: change the existing `pr-review-verify` fixture - lost: it is the case of a left blocker, and a request for changes there would not show that the new finding caused it.

### D8. A test against conflict markers

The merge of #277 into `staging/v3` left `<<<<<<<`/`=======`/`>>>>>>>` blocks in two skills and a main spec, and no check failed: Markdown lint does not read them as errors. A root test lists tracked text files with `git ls-files` and fails on a line that is a conflict marker. It is cheap, runs in `pnpm check`, and catches every later case.

## Risks / Trade-offs

- [A verify run costs about a review run again] -> the reviewers read only the delta's files; with no new commit only the judge runs (D6). Measured below.
- [The integration reviewer on a delta flags a plan part whose files the delta does not touch] -> the judge levels it against the pull request's intent; measured in the eval. A delta-aware anchor in `bdk git groups` would be the follow-up if runs show such findings posted.
- [A group reviewer repeats an unfixed previous finding] -> the judge keeps the earlier one (D3).
- [The previous head was never fetched (another machine, a deleted branch)] -> `merge-base --is-ancestor` fails, the whole pull request is reviewed (D1).

## Measurements

Claude Code 2.1.292, macOS, clean `HOME` and the git shell prefix of the eval README "Host limits".

Eval (`claude plugin eval`, `--ablation none`, 3 runs each, `-j 2`, 771 s wall clock, $6.44):

| Case | Score | Cost per run | Time per run |
|---|---|---|---|
| `pr-review-verify-regression` | 1.00 (13/13 graders in each run: both threads resolved, `7-2.json` `REQUEST_CHANGES` with an inline `kind=finding` comment on `src/report.js`, group `p02` recorded without the Change's proposal) | $1.10 to $1.29 | 236 to 248 s |
| `pr-review-verify` | 1.00 (13/13: only `PRRT_7_1_1` resolved, `REQUEST_CHANGES`, group `p01`) | $0.96 to $1.02 | 241 to 287 s |

A verify run now costs about a review run of a small delta: `pr-review-verify` went from $0.62 and 103 s (#256, judge only) to about $0.99 and 259 s, the price of reading the new commits. A verify with no new commit still runs the judge alone (D6).

By hand (task 4.2), `claude -p "/bdk:pr-review --verify 7" --plugin-dir plugins/bdk --permission-mode auto` in a project built from `monthly-report-pr-regressed.sh`, without `AskUserQuestion`: nothing posted, no thread resolved, the reply ended with the question, computed verdict "Request changes", both previous blockers fixed (`not-a-problem`: the judge traced the `padEnd` fix and the division by 100). `result.md` named `Range:` from the merge base and `Reviewed:` from the previous head `e0cae7a`. New findings: the overwrite in `src/report.js:9` (`blocker`), the test with one entry per month and the missing end-to-end test of "Totals per month" (`should-fix`), a blank line that throws (`nice-to-have`). No finding about a plan part the delta does not touch, so no delta anchor in `bdk git groups` (risk of the integration reviewer, above). $1.04, 6 turns.

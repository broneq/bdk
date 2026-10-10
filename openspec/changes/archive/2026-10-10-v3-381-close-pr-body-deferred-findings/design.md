# Design

## Context

- `/bdk:auto-review` step 8 writes `## Deferred` of `review/result.md`: every finding decided `defer` in any round, one bullet each with place, summary, level and the issue when it has one; an empty section holds `- None.` (spec `bdk-auto-review`, "Review result").
- `/bdk:close` step 7 builds the pull request body from files; since #375 it reads `review/result.md` for `## Decisions taken without the user` and nothing else of it.
- The `close-*` cases start from `fixtures/tally-reviewed.sh`, whose run files hold no `review/result.md`; `close-review-decisions` (#375) adds one with `## Deferred` set to `- None.`.

## Goals / Non-Goals

**Goals:**

- The PR body lists every finding the review deferred, so its reviewer sees what was knowingly left out.

**Non-Goals:**

- Which findings get deferred, or creating issues for them: that is `/bdk:triage`'s and `/bdk:auto-review`'s.
- Findings decided `accept`: they are closed, not left for later, and `review/result.md` does not list them.
- `/bdk:run`'s final report: it reports per Change the `PR:` line and the decisions; the deferred findings are in the PR it links.

## Decisions

### D1: Every deferred bullet goes into the body, as written

Close copies all bullets of `## Deferred`, in their order, skipping only `- None.`; it does not reduce `nice-to-have` deferrals without an issue to a count.

- Why: a deferral without an issue is the one most likely to be forgotten, since nothing else tracks it; the PR is its last visible record. `/bdk:auto-review` already chose what belongs in the section, and the list is short (one line per finding). Copying lines keeps close from doing a block's work (close does not judge findings).
- Alternative: a count for `nice-to-have` without an issue. Lost: the place and summary, so the reviewer cannot tell whether to accept the deferral; close would also have to parse the level out of each line.
- Decided without the user: the issue left this open under "To resolve in the spec"; this is the answer recommended for a reviewer who must see what the review left.

### D2: A separate `Deferred` part, present only when it has a line

The body gets a `Deferred` part after the decisions part; with no deferred finding, the part is left out.

- Why: a deferred finding is not a decision taken without the user (with `policy.gates.review: manual` the user deferred it), so it does not belong in the decisions groups. No deferred finding is the normal case and needs no line; the review count already says whether a review ran.
- Alternative: `Deferred: none` on every body. Lost: one more line of noise on every pull request.

### D3: The close reply names the deferred findings

Step 8 adds the deferred findings, as in the body, to the reply.

- Why: the reply is what the user reads when close ends; it already repeats the decisions from the body for the same reason.

### D4: A new case `close-deferred-findings`

The case scaffolds `tally-reviewed.sh`, then writes `review/result.md` with `Status: done`, an auto triage decision and two deferred findings: a `should-fix` with issue `#12` and a `nice-to-have` without an issue. Graders: the recorded PR body holds both findings' summaries and the issue; the reply names the deferred findings.

- Why: the same reason as #375's D4: `tally-reviewed.sh` is shared, and one case per part of the body shows which grader a regression breaks.
- Alternative: add deferrals to `close-review-decisions`. Lost: that case would grade two parts of the body at once.

## Risks / Trade-offs

- A round with many deferrals makes the body longer. Accepted: it is one line per finding, and each is something the reviewer should weigh.

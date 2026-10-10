# Design

## Context

- `/bdk:close` step 7 gathers the pull request body from files. Its "Decisions taken without the user" part reads only `## Decided without the user` of `proposal.md` and the `Decided without the user:` lines of `design.md` (spec `bdk-close`, "Pull request into the base branch").
- `/bdk:auto-review` step 8 writes `review/result.md` with `## Decisions taken without the user`: auto triage, `--last-round` deferrals, round gaps the stage went on with (spec `bdk-auto-review`, "Review result"). In #368's run it also held the fix pass's product decisions.
- `/bdk:run` step 9 lists decisions from `close/pr.md` and `review/result.md`, but that reply goes to the caller, not into the PR.
- The `close-*` cases start from `fixtures/tally-reviewed.sh`, whose run files hold no `review/result.md`.

## Goals / Non-Goals

**Goals:**

- The PR body names every decision the review stage recorded as taken without the user.
- `/bdk:run`'s final report lists each decision once.

**Non-Goals:**

- What `/bdk:auto-review` records under `## Decisions taken without the user`: close copies the section, it does not judge it.
- Decisions of the execute stage (`execute/result.md`): they are about plan problems, escalations and merges, not the product, and no issue asks for them in the PR.
- The `## Deferred` findings of `review/result.md` in the PR body: a separate gap, tracked in its own issue.

## Decisions

### D1: Every bullet of the review section goes into the body, auto triage included

Close copies all bullets of `## Decisions taken without the user` of `review/result.md`, in their order, skipping only `- None.`.

- Why: auto triage decided which findings were fixed, accepted or deferred; a PR reviewer who does not know that the triage was not theirs cannot weigh the deferred findings. `/bdk:auto-review` already chose what belongs in the section, so one source decides it.
- Alternative: only product decisions. Lost: close would have to tell a product decision from a process one by reading prose, a judgment it does not own (close does no block's work), and the line between them is fuzzy (a `--last-round` deferral is both).
- Decided without the user: the issue left this open under "To resolve in the spec"; this is the answer recommended for a reader who must see what was decided for them.

### D2: The decisions part groups lines by source

The body's decisions part holds up to three groups, `Proposal:`, `Design:` and `Review:`, each only when it has a line; with none at all, `none`.

- Why: a reviewer who questions a decision needs to know which file to read and which stage to rerun (`/bdk:design` versus `/bdk:auto-review`).
- Alternative: one flat list. Lost: the same line text ("Round 1: ...") is ambiguous without its source.

### D3: `/bdk:run` reads decisions from `close/pr.md` only

Step 9 takes the decisions part of `close/pr.md`; it no longer reads `review/result.md`.

- Why: with D1 the PR body holds the review's decisions too, so reading both lists each review decision twice. One source keeps the final report equal to what the PR shows.
- Alternative: keep both reads and deduplicate. Lost: the model would compare lines by text; duplicates or drops are the likely failure.
- A Change in the final report is `done` (it has `close/pr.md`) or waiting on blockers before it started, so no Change with review decisions lacks `close/pr.md`.

### D4: A new case `close-review-decisions` instead of changing the shared fixture

The case scaffolds `tally-reviewed.sh`, then writes `review/result.md` with `Status: done`, an auto triage line and a product decision. Graders: the recorded PR body holds the product decision and the triage line; the reply names the product decision.

- Why: `tally-reviewed.sh` is shared with `close-*`, `run-*` and `*-model*` cases; a `review/result.md` there would change what their graders see. A dedicated case is the acceptance signal of #375.
- Alternative: extend `close-reviewed-change`. Lost: that case grades the plain close; mixing the decisions into it hides which grader a regression breaks.

## Risks / Trade-offs

- A long triage section makes the PR body longer. Accepted: it is one line per round.
- `review/result.md` from a stale run of the same Change name would leak into the body. The run directory is per Change and `/bdk:auto-review` replaces the file each run; no new risk.

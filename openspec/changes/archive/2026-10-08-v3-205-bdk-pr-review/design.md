# Design

## Context

See proposal.md for why. What this Change builds on:

- Architecture (`docs/design/2026-10-07-v3-architecture.md`): D1 (hybrid; PR review is a long mechanical stage in a lead), "Layers" (`/bdk:pr-review` is a thin main-thread skill that starts `bdk:lead` with the stage skill; the lead starts workers as foreground `Agent` calls), "Catalog" (`/bdk:pr-review` composes `review-group`, `review-integration`, `judge` on a GitHub PR; writes PR comments). ADR-0003 principles 2 (one block, one job) and 7 (plain skill first).
- What exists: the review blocks on `bdk:reviewer`, `bdk:integration-reviewer` (opus) and `bdk:judge`, reading a round directory with `groups.json` and appending to `findings.jsonl`, and `bdk findings report` writing `report.md` (#193, spec `review-blocks`); `bdk git groups --record` (#186); `bdk:lead`, `execution.lead`, `execution.max-parallel` (default 10), `--workdir` in the execute blocks and the probes behind it (#200 D2: a subagent cannot change its working directory; the host refuses `cd` followed by `git`, so git runs as `git -C`); the guard `hooks.subagent-git`, which exempts `bdk:lead` (#182); the offline `gh` stand-in and the bare `origin` inside the workspace (#202, `tally-reviewed.sh`); the `monthly-report` fixture with a logic bug in part 01 and a cents/dollars seam bug between parts 01 and 02 (#193); the host refusing a subagent's `Write` of a file named `report*`/`summary*` `.md` (#193 D6, #200 D9).
- Material read, not copied: v2 `skills/pr-review` (one general-purpose subagent per PR running `/bdk:cr --inline`, worktree per PR from `pull/<n>/head`, confirmation of the verdict before posting, one review call per PR, inline comments only for blockers, own-PR `COMMENT`, 422 fallback, hidden markers, verify mode); draft 1 `skills/tools/pr-review` and `skills/roles/pr-reviewer` (a fork role per PR, a brief built from the PR description, linked issues and the Change the PR carries, a Lavish decision page rendered by `bdk review render`, a tracker disposition). Kept: the worktree of the PR head, the brief as the intent, the Change found in the diff, nothing posted before the user confirms, one review per PR, own-PR `COMMENT`, the anchor fallback, the hidden marker, the full nice-to-have list shown before confirming. Dropped: `/bdk:cr --inline` (the v3 blocks replace it), the fork role and its result block, the kernel `bdk review render`, the decision page per finding (the judge's levels decide), the tracker disposition, severity and category vocabularies (the judge's four levels are the vocabulary).

## Goals / Non-Goals

**Goals:**

- `/bdk:pr-review <pr>` reviews a pull request with the same blocks as a Change review, in a lead, and leaves the main thread one result line and a report.
- The user's checkout is never touched; the review reads the PR head in its own worktree.
- One GitHub review per run, posted only after the user confirms it, rendered from fixed templates.
- An eval case on a fixture PR (issue, "Acceptance signal").

**Non-Goals:**

- `/bdk:auto-review` and the `review-round` lead skill (#201). The two lead skills compose the same blocks for different inputs; neither calls the other.
- A verify mode (did the author address the previous review's threads), several PRs in one call, stack expansion: v2 had them; no v3.0 acceptance needs them. A follow-up issue holds them.
- Checks and E2E on the PR: the PR's CI runs the checks, and E2E of a teammate's branch would start their code on the user's machine.
- A CLI helper: no eval or measurement asked for one (D9).

## Decisions

### D1. Two skills on the shared lead: `pr-review` and `pr-review-round`

`/bdk:pr-review` (main thread) does what needs GitHub or the user: reads the PR, writes the brief, starts the lead, renders the review, asks, posts. `pr-review-round` (`user-invocable: false`, on `bdk:lead`) does the mechanical stage: fetch, worktree, groups, reviewers, integration, judge, result. The lead is started with `Run the skill bdk:pr-review-round with the arguments: <n> --run-dir <abs>`, the pattern of #200 D1.

Why: the architecture names the thin command and the lead; the lead cannot ask the user (`AskUserQuestion` is not available to a subagent), and posting must wait for the user, so posting stays in the main thread. Keeping GitHub calls out of the lead also keeps `gh` out of the lead's grants.

Alternatives: everything in the main thread (architecture option A) - lost: four or more agent results and their turns land in the main thread, the cost the architecture moved into leads. Reusing #201's `review-round` with a PR mode - lost: not merged, and it runs checks and E2E and drives fixes; one block one job. The lead posting after a `SendMessage` with the user's answer - lost: a second lead turn for one `gh api` call, and the main thread holds the rendered review the user saw.

### D2. The review blocks read another checkout through `--workdir`, `--change`, `--intent`

The blocks took the code from the working directory and the Change from the run directory's name. For a PR both are wrong: the head is another commit, and the Change (if any) may be archived (`/bdk:close` archives before the PR) or absent. The three options are optional and keep the blocks' standalone and round behaviour:

- `--workdir`: as in `implement-part` (#200 D2): absolute paths under it for Read/Grep/Glob, `git -C <workdir>`, `cd <workdir> && <bdk ...>`, one command per call.
- `--change <path>|none`: the Change directory relative to the work directory.
- `--intent <file>`: the PR brief, read as the intent next to (or instead of) the Change; the blocks already said "without a Change, the intent is the commit subjects and what the user said", and the brief is what the user (the PR author) said, as a file.

Alternatives: the lead pastes the intent and paths into each prompt (draft 1's dispatch package) - lost: a second place for the stage's flow, and the judge and integration reviewer would get different copies. Reading files with `git show <head>:<file>` from the main checkout - lost: Grep and Glob do not see a commit, and tests that cover a file are found by searching the tree. A new block set for PRs - lost: the same three jobs twice.

### D3. Run directory `.bdk/runs/pr-<N>/` and a worktree inside it

The brief `pr.md`, the worktree `worktree/`, the rounds `review/round-<k>/` and `result.md` live in `.bdk/runs/pr-<N>/`. `/bdk:setup` ignores `.bdk/runs/`, so the worktree never shows in `git status`, and `bdk run status` reads only Changes queued in `run.json`, so `pr-<N>` is not taken for a Change. The worktree is detached at the head commit, made fresh on every run (removed with `git worktree remove --force` first when a crashed run left it) and removed after the judge: the main thread renders from git objects, which the worktree shares with the main checkout.

Each run is a new round that reviews the whole PR from the merge base (no `--rounds`): a posted review must stand alone, and a PR whose head was force-pushed has no ancestor round to anchor on. Incremental re-review belongs to the verify follow-up.

Alternatives: `.bdk/runs/manual/` - lost: it holds the standalone rounds of the blocks, and two PRs would share one round sequence. A worktree in the system temp directory (v2) - lost: a sandboxed agent may not reach it (#200 D2). Reusing the worktree across runs - lost: a stale tree from an earlier head.

### D4. Fetch by `pull/<N>/head`, check against the brief

The lead runs `git fetch origin pull/<N>/head` (works for fork PRs, where the head branch is not on `origin`) and checks `git rev-parse FETCH_HEAD` against `headRefOid` of the brief; then `git fetch origin <base>`, which updates `origin/<base>`. A moved head blocks the run: the review would describe another commit than the one the user sees on GitHub and the one the review's `commit_id` names. The base is `origin/<base>`, so a stacked PR (base is another PR's branch) is reviewed only on its own diff without any stack logic.

### D5. The Change of a PR: the one `proposal.md` the range adds or changes

`git -C <worktree> diff --name-only <merge-base>..<head> -- openspec/changes/` and the directories among them holding `proposal.md` at the head. Exactly one is the Change; none or several means no Change (a PR touching two Changes is reviewed by its intent). With plan parts, `bdk git groups --plan <change>/plan/parts` gives one group per part, as in a Change review.

### D6. Workers: reviewers in batches, then integration, then judge

As the review round of the architecture ("Flows / Review round"), without checks: one `bdk:reviewer` per group except `integration`, at most `execution.max-parallel` foreground calls per message (#200 D5), then `bdk:integration-reviewer`, then `bdk:judge`. Each prompt: `Review group <id> of the round <round dir> --workdir <wt> --change <c>|none --intent <run dir>/pr.md` (reviewer), the same without a group for the others. A worker that returns without its output (no finding line for a reviewer is fine; no `report.md` after the judge is not) is started once more; a second miss blocks the run.

### D7. The rendered review: D2 levels map to GitHub

| Level | Where | Verdict |
|---|---|---|
| `blocker` | inline comment | `request-changes` |
| `should-fix` | inline comment | none by itself |
| `nice-to-have` | summary line | none |
| `not-a-problem` | not posted | none |

An inline comment opens a thread a reader must resolve; `blocker` and `should-fix` both mean "change this", `nice-to-have` does not (v2's rule that nice-to-haves never go inline). A finding whose line lies outside the diff's hunks cannot be an inline comment (GitHub returns 422), so it goes to the summary's "Outside the diff" section; the main thread checks the hunk ranges of `git diff <range> -- <file>` on the new side. The review's `commit_id` is the head commit of the brief. The summary ends with `<!-- bdk-pr-review v3 verdict=<v> head=<sha> -->`, which a later verify mode reads.

Alternatives: a severity vocabulary (v2's CRITICAL..LOW) - lost: a second classification beside the judge's levels. `should-fix` in the summary only - lost: it loses its anchor and a reviewer's "change this" would not show on the line.

### D8. Nothing posted without the user

The review is shown in full (verdict, every inline comment, every summary line), then: with `policy.questions: stop` (default) `AskUserQuestion` with four options (computed verdict recommended, the other verdict, comment only, do not post); without the tool (non-interactive), the question goes at the end of the reply and nothing is posted, and `/bdk:pr-review <n>` again re-renders from the finished round without a new review (the round with `report.md` and no `posted.md`, named by a `result.md` whose head is still the PR's head). After posting, `posted.md` in the round records the review's URL, event and verdict, so a second call never posts the same round twice. With `decide-and-record`, or a request that says to post without asking, the computed verdict is posted and the reply says so. Own PR: `COMMENT`, as GitHub rejects self-approval.

Posting is outward-facing (global instruction: confirm first unless authorised); the configuration and the user's own words are the two durable authorisations.

### D9. No CLI helper

Every step is `gh`, `git`, `bdk git groups`, `bdk findings list|report`, a `Write` of the brief, the result or the review JSON, and `Agent` calls. Rendering the review JSON is a model turn; draft 1 had a `bdk review render` for its decision page, which v3 does not have. If the eval runs show wrong anchors or a malformed payload, that is the recorded problem that admits a helper.

### D10. Offline `gh` for the eval

The stand-in gains `gh pr view <n>|<url>`, `gh repo view`, `gh api user` and `gh api .../reviews -X POST --input <file>` (recorded under `.git/bdk-eval/reviews/`). The fixture `monthly-report-pr.sh` pushes `main` and `refs/pull/7/head` to a bare `origin` in the workspace, writes `prs/7.json` with `headRefOid`, and leaves the user on `main` without the PR branch, as when reviewing a teammate's PR. `remote.origin.uploadpack` names git's own `git-upload-pack` for the Mac sandbox ("Host limits").

## Risks / Trade-offs

- [A reviewer reads the main checkout instead of the worktree] -> `--workdir` is in every worker prompt and in the block text's path rule; the eval fixture's main checkout is on `main`, where `src/parse.js` does not exist, so a wrong read finds nothing.
- [Inline anchor rejected (422)] -> the main thread moves inline comments into the summary and posts once more; never the same payload twice.
- [Opus integration reviewer on every PR] -> one agent per review, as in a Change round.
- [A large PR] -> `bdk git groups` packs files into groups of about 30; `execution.max-parallel` batches the reviewers.
- [Posting the wrong head] -> `commit_id` is the brief's head, and the lead blocks when the fetched head differs.
- [PR head runs nothing on the user's machine] -> the lead and blocks only read and run git; no check or E2E runs on the PR's code.

## Measurements

Claude Code 2.1.294, macOS, clean `HOME` and the git shell prefix of the eval README "Host limits".

By hand (task 4.3), `claude -p --plugin-dir plugins/bdk --permission-mode auto` in scratch projects built from `monthly-report-pr.sh`:

| Prompt | Result |
|---|---|
| "Review https://github.com/bdk-eval/repo/pull/7 and post the review to GitHub. Don't ask me first, post it right away." | Posted one `REQUEST_CHANGES` review on the head commit: inline `blocker` on `src/report.js:12` (cents formatted as currency units) and `src/parse.js:13` (fewer decimals), inline `should-fix` on `src/parse.test.js` and `bin/ledger.js`, one `nice-to-have` in the summary, the hidden marker. Round report 5 findings (2 blocker, 2 should-fix, 1 nice-to-have). Checkout still on `main`, worktree removed. About 3.5 minutes, $1.03. |
| "Review pull request #7." | Nothing posted; the reply showed the computed verdict and all 6 findings and ended with the four posting options. $1.00. |

Eval (`claude plugin eval`, `--ablation none`):

| Case | Runs | Score | Cost |
|---|---|---|---|
| `pr-review-post` | 2 | 1.00, 1.00 | $0.90, $1.00 (236 s) |
| `pr-review-confirm` | 2 | 1.00, 1.00 | $0.94, $0.96 |
| `review-group-logic-bug` (regression, blocks without the new inputs) | 1 | 1.00 | $0.26 |
| `review-integration-seam` (same) | 1 | 1.00 | $0.30 |
| `judge-levels` (same) | 1 | 1.00 | $0.26 |

A third `pr-review-post` run was cut by a `Terminated` signal from outside the harness before its graders ran; the repeat scored 1.00 (second row). No run showed a wrong anchor or a malformed payload, so no CLI helper for the review JSON (D9).

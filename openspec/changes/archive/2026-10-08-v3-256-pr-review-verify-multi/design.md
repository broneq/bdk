# Design

## Context

See proposal.md for why. What this Change builds on:

- #205 (archived Change `2026-10-08-v3-205-bdk-pr-review`): `/bdk:pr-review` in the main thread, the lead skill `pr-review-round` on `bdk:lead` (D1), the run directory `.bdk/runs/pr-<N>/` with the brief `pr.md`, a fresh worktree and rounds `review/round-<k>/` (D3), the fetch of `pull/<N>/head` checked against the brief (D4), the review blocks with `--workdir`, `--change`, `--intent` (D2), the rendering of the judge's levels with the hidden markers `bdk-pr-review v3 kind=finding id=<id> level=<level>` and `kind=summary verdict=<v> head=<sha>` (D7), and the confirmation rules (D8).
- The judge block (#193, spec `review-blocks`): for each unleveled finding of a round it traces the evidence's failure scenario through the code and sets `not-a-problem` when the scenario does not hold.
- Architecture: D1 (hybrid; a lead per long mechanical stage), "Layers", ADR-0003 principles 2 (one block, one job) and 7 (plain skill first).
- Material read, not copied: v2 `skills/pr-review` (`--verify`: a subagent per PR classifies each previous finding addressed / partially / not addressed from the code, not the replies, also reviews the commits since the reviewed head; the orchestrator posts a verification summary and then resolves our addressed threads only; several URLs per call, one `AskUserQuestion` call with up to four questions; sequential fetches because parallel fetches contend on ref locks); draft 1 `skills/tools/pr-review` and `skills/roles/pr-reviewer` (threads listed in the brief with id, path and line; the role classifies `fixed` / `not-fixed` / `outdated`). Kept: judge the code, not the replies; a half fix is not fixed; resolve only our threads and only after posting; one confirmation for all pull requests. Dropped: a separate verify classifier and its vocabulary (the judge's levels already answer "does this still fail"), v1 markers, posting before every pull request is confirmed.

## Goals / Non-Goals

**Goals:**

- `/bdk:pr-review --verify <pr>` checks each `blocker` and `should-fix` finding of the previous review at the current head, resolves the threads of the fixed ones, and posts one review of what is left.
- Several pull requests in one call, reviewed in parallel, confirmed once.
- An eval case for each (issue, "Scope" and "Acceptance signal").

**Non-Goals:**

- A review of the commits added since the previous review in verify mode (D3, follow-up issue).
- Stacked-PR expansion, `/bdk:auto-review`.
- A CLI helper (D8).

## Decisions

### D1. The judge re-checks a previous finding; no new block

Verify mode is a round whose findings log the lead seeds with the previous review's `blocker` and `should-fix` findings (`bdk findings add --source previous-review`, with the file, line, summary and evidence the posted comment holds), and whose only worker is `bdk:judge`, with `--workdir <worktree> --change <c>|none --intent <run dir>/pr.md` as in a review round. The judge's question for every finding is already "does the failure scenario still hold in this code": `not-a-problem` means it does not, so the finding is fixed; `blocker`, `should-fix` or `nice-to-have` means it is left, at that level now.

Why: the check of a previous finding is the judge's job on another log (one block, one job), it runs on one sonnet agent, and its level carries over to the verdict without a second vocabulary.

Alternatives: a new block `recheck-findings` on a new agent with `fixed` / `not-fixed` (draft 1) - lost: a second agent doing what the judge does, with a vocabulary that then maps back to levels. The reviewers' "Fixed findings" check of `review-group` (step 3.5) - lost: it reports only a failure that still happens, so a fix is the absence of a finding, and a reviewer that skipped a finding would resolve its thread. The main thread judging the code - lost: the main thread never reviews code (#205 D1).

`not-a-problem` also covers a finding the judge now calls out of scope or a duplicate. Its thread is resolved too: the review no longer asks for that change, and the level reason is in the verify review.

### D2. Previous findings come from GitHub, not from local rounds

The main thread runs one `gh api graphql` query for the pull request's reviews (body, author, URL) and review threads (id, `isResolved`, path, `line`, `originalLine`, first comment). The previous review is the newest review by the current user (`gh api user`) whose body holds `bdk-pr-review v3 kind=summary` or `kind=verify-summary`. The findings to check are:

- each unresolved thread whose first comment is the current user's and holds `bdk-pr-review v3 kind=finding` with `level=blocker` or `level=should-fix`: summary and evidence from the comment body (D7 of #205), line `line`, else `originalLine`;
- each `blocker` or `should-fix` line of the previous summary's "Outside the diff" section (no thread: after the 422 fallback every finding lands there).

They go to `<run dir>/previous.json` as `[{ "thread": "<id>" | null, "id": "<previous finding id>" | null, "level", "file", "line", "summary", "evidence" }]`. No previous review: say so, name `/bdk:pr-review <N>`, start nothing. No finding to check: say there is nothing left to verify, start nothing.

Why: the review on GitHub is the record the author answered, and the round on this machine may not exist (another reviewer's machine, a cleaned `.bdk/runs/`). Only the current user's threads: resolving another reviewer's thread hides their open feedback (v2).

### D3. Verify does not re-review the new commits

The verify round checks the previous findings only. The verify review states the head it checked, and says that the commits since the previous head were checked only against the previous findings and that `/bdk:pr-review <N>` reviews the whole pull request again. Verdict: `request-changes` when a re-checked finding is `blocker`, else `approve`; `should-fix` left keeps its thread open without blocking, as in #205 D7.

Why: the issue's scope is the thread check, and a second full round would double the time of a verify run. Recorded as a follow-up issue: review the range from the previous head (or the merge base after a force-push) in the same round, so verify can approve only code it read.

### D4. The verify round in the lead

`pr-review-round <N> --run-dir <d> --verify`: steps 1 to 3 as in a review (inputs, fetch and worktree, the Change), then instead of groups and reviewers: read `<run dir>/previous.json`, add each entry to `<round dir>/findings.jsonl`, write `<round dir>/previous.json` with each entry's `finding` id (the id `bdk findings add` printed), start one `bdk:judge`, then remove the worktree and write `result.md` with `- Mode: verify`. A review round's `result.md` says `- Mode: review`. The main thread reuses a finished round only when its mode is the mode asked (#205 D8 reuse rule).

Alternatives: the main thread seeds the log before starting the lead - lost: several `bdk` calls in the main thread, and the main thread would have to agree with the lead on the round number. Separate `verify/round-<k>/` directories - lost: a second round sequence for one run directory, and `bdk findings` reads any log.

### D5. Rendering and posting a verify review

A new template "Verify summary" in `references/comment-templates.md`: what was checked (the previous review's URL, its head and the current head), a "Left" list (level, place, summary, the judge's reason), a "Fixed" list (place, summary), the verdict, the note of D3, and the marker `<!-- bdk-pr-review v3 kind=verify-summary verdict=<v> head=<sha> -->`. The payload has no `comments`: open threads already sit on their lines. The confirmation is D8 of #205 unchanged. After the review is posted, the main thread resolves each fixed finding's thread:

```
gh api graphql -f query='mutation($t:ID!){resolveReviewThread(input:{threadId:$t}){thread{isResolved}}}' -F t=<thread id>
```

never a thread outside `previous.json`, and not when the user chose not to post. `posted.md` lists the resolved threads.

Why post first: when posting fails, no thread is closed without the review that says why.

### D6. Several pull requests in one call

`/bdk:pr-review <pr> [<pr> ...] [--verify]`: `--verify` applies to every pull request of the call. Step 1 (and step 2 of verify) runs per pull request; a pull request that fails a check is reported and left out. Then one background `bdk:lead` per pull request, all in one message, at most `execution.max-parallel` at a time (the next ones start as notifications arrive). After the last lead returned, the main thread renders every review and shows them all, then asks once: with up to four pull requests one `AskUserQuestion` call with one question per pull request (the four options of #205 D8); with more, one question with the options "post every review with its computed verdict (Recommended)", "choose per pull request" (then calls of up to four questions), "post none". Each review is posted on its own; a failure of one does not stop the others. The reply has one line per pull request.

Why: the leads are independent and long; one confirmation after all of them keeps the user from waiting on the slowest review once per pull request (v2's "one confirmation for the run").

### D7. A fetch safe for parallel leads

Two leads in one repository share `FETCH_HEAD` and the ref `origin/<base>`. #205's lead read `FETCH_HEAD` after its fetch: with two leads, one could read the other's head and block with a wrong "head moved" or make the worktree at the wrong commit. Now the lead:

1. `git ls-remote origin refs/pull/<N>/head`: its commit must be the brief's head commit (else the "head moved" blocker of #205 D4);
2. `git fetch --no-write-fetch-head origin pull/<N>/head <base>`: the head's objects, and `origin/<base>` updated through the remote's configured refspec;
3. a fetch that fails on a lock (`cannot lock ref`, `Unable to create ... .lock`) runs once more;
4. `git worktree add --detach <worktree> <head commit>`.

Alternatives: fetch into a named ref `refs/bdk/pr-<N>` - lost: a ref left in the user's repository to clean up. Fetches in the main thread before the leads - lost: the lead skill then depends on its caller for a step it does itself when run alone.

### D8. No CLI helper

Reading threads is one `gh api graphql` call, seeding is `bdk findings add`, the check is the judge, rendering is a model turn. If eval runs show a wrong parse of the comment bodies, that is the problem that would admit a helper.

### D9. Offline `gh` for the eval

`gh api graphql -f query=<q> [-f|-F <key>=<value>]...`: a query naming `reviewThreads` answers `data.repository.pullRequest` with `reviews.nodes` (`id`, `body`, `url`, `state`, `author.login` `bdk-eval-user`, `commit.oid`) and `reviewThreads.nodes` (one thread per inline comment of each recorded review: `id` `PRRT_<n>_<k>_<i>`, `isResolved`, `isOutdated` false, `path`, `line`, `originalLine`, `comments.nodes` with the comment's `body`, `url` and author), for the pull request of the variable `pr` (or `number`); a mutation naming `resolveReviewThread` marks the thread of the variable `t` (or `threadId`) resolved in `.git/bdk-eval/resolved.json` and answers `{"data":{"resolveReviewThread":{"thread":{"isResolved":true}}}}`; an unknown thread exits 1. Threads come from recorded reviews, so a fixture writes a previous review the same way a posted one is recorded.

## Risks / Trade-offs

- [The judge calls an unfixed finding `not-a-problem`] -> its evidence is the original failure scenario, which it traces at the head; the verify review shows the judge's reason for every fixed finding before anything is posted.
- [The line of a previous finding moved] -> the judge reads the file and traces the scenario, not the line alone; the line is where the previous review put it.
- [A fix introduced a new defect elsewhere] -> not caught by verify (D3); the review says so and names the full review.
- [Parallel leads contend on `git fetch`] -> D7.
- [Many pull requests at once] -> `execution.max-parallel` bounds the leads; each lead bounds its own reviewers.

## Measurements

Claude Code 2.1.292, macOS, clean `HOME` and the git shell prefix of the eval README "Host limits".

Eval (`claude plugin eval`, `--ablation none`, one run each):

| Case | Score | Cost | Time |
|---|---|---|---|
| `pr-review-verify` | 1.00 (10/10 graders: only `PRRT_7_1_1` resolved, `7-2.json` `REQUEST_CHANGES` with `kind=verify-summary`) | $0.62 | 103 s |
| `pr-review-several` | 1.00 (9/9: `7-1.json` `REQUEST_CHANGES`, `8-1.json` `APPROVE`, two leads) | $1.43 | 299 s |
| `pr-review-post` (regression of the new fetch) | 1.00 (11/11) | $0.98 | 246 s |

By hand (task 4.2), `claude -p "Review pull requests 7 and 8." --plugin-dir plugins/bdk --permission-mode auto` in a project built from `monthly-report-two-prs.sh` with `execution.lead: foreground`: nothing posted, both reviews shown (7: request changes, 2 blocker, 2 should-fix, 1 nice-to-have; 8: approve, no findings), and the reply ended with one question for both pull requests. $1.29, 672 s, 11 turns.

A verify run costs about half a review run: one judge instead of reviewers, an integration reviewer and a judge. No run showed a misparsed comment body or a wrong thread, so no CLI helper (D8).

---
name: pr-review
description: 'Reviews GitHub pull requests with the BDK review blocks - starts one bdk:lead agent per pull request that reviews its head in its own worktree (a reviewer per group, an integration reviewer, a judge), renders one GitHub review each with inline comments and a verdict, shows them, and posts them with gh only after the user confirms. --verify re-checks the previous review: which blocker and should-fix findings the author fixed, resolving their threads, and reviews the commits added since it. Use when asked to review one or several pull requests (URLs or numbers, or "the PR of this branch"), or to verify, re-review or re-check a pull request after the author answered a review.'
argument-hint: "[<pr-url> | <number>]... [--verify]"
allowed-tools: Bash(${CLAUDE_PLUGIN_ROOT}/bin/bdk *) Bash(gh pr view *) Bash(gh repo view *) Bash(gh api *) Bash(git rev-parse *) Bash(git diff *) Read Write Glob Grep Agent SendMessage ToolSearch AskUserQuestion
---

Current BDK configuration of this project:

!`"${CLAUDE_PLUGIN_ROOT}/bin/bdk" config show`

Arguments: $ARGUMENTS

# PR review

You start one review lead per pull request, turn each judged round into one GitHub review, and post them once the user agrees. The leads and their workers review; you never review code, set a level, start a reviewer, or edit a project file. Nothing reaches GitHub before step 8 allows it: the author and the team read what you post.

The mode is `verify` with `--verify` (it applies to every pull request of the call), else `review`. Each step below runs for every pull request of the call; a pull request that stops is left out of the later steps, and its reason goes into the reply.

## 1. Check the configuration and the pull requests

When the block above says `BDK not configured: run /bdk:setup` or that the configuration is invalid, stop: start nothing and reply with that line.

1. **Pull requests**: each argument that is a URL or a number; without one, the pull request of the current branch. For each run `gh pr view <argument> --json number,url,title,state,isDraft,author,body,baseRefName,headRefName,headRefOid,closingIssuesReferences` (no argument: leave it out). No pull request: say so. `state` not `OPEN`: say it is not open.
2. **Repository**: `gh repo view --json nameWithOwner`, once. A pull request whose URL names another `<owner>/<repo>` stops with: run the review in a checkout of that repository.
3. **User**: `gh api user`, once; keep its `login`.
4. **Run directory**: `.bdk/runs/pr-<number>` under the path `git rev-parse --show-toplevel` prints, as an absolute path.
5. **Finished round**: when `<run dir>/result.md` starts with `Status: done`, its `Mode` is this call's mode, its `Head commit` is the pull request's `headRefOid`, and its round holds `review.md` but no `posted.md`, that round is already judged: this pull request skips steps 3 and 4 (in verify mode it still runs step 2, for the previous review's URL and head).

Done when each pull request is kept or stopped with its reason, and you know which reuse a finished round.

## 2. Verify mode: read the previous review

Review mode skips this step. Run, for the pull request:

```
gh api graphql -f query='query($owner:String!,$repo:String!,$pr:Int!){repository(owner:$owner,name:$repo){pullRequest(number:$pr){reviews(last:100){nodes{id body state url author{login} commit{oid}}} reviewThreads(first:100){nodes{id isResolved isOutdated path line originalLine comments(first:1){nodes{author{login} body url}}}}}}}' -F owner=<owner> -F repo=<repo> -F pr=<number>
```

1. **Previous review**: the last review whose author is the user's `login` and whose body holds `bdk-pr-review v3 kind=summary` or `bdk-pr-review v3 kind=verify-summary`. None: the pull request stops with "no BDK review of yours to verify: `/bdk:pr-review <number>` reviews it". Keep its `url` and the `head=` of its marker.
2. **Threads**: each thread with `isResolved` false whose first comment's author is the user's `login` and whose body holds `bdk-pr-review v3 kind=finding` with `level=blocker` or `level=should-fix`. From the comment ([references/comment-templates.md](references/comment-templates.md), "Inline comment"): the level, the summary (after `**[<level>]** `), the evidence (the paragraph after it), the `id=` of the marker. The line is `line`, else `originalLine`.
3. **Outside the diff**: each line of the previous review's "Outside the diff" section with `**[blocker]**` or `**[should-fix]**`: `` `<file>:<line>` - **[<level>]** <summary>. <evidence> ``; of a verify review also each "Left" line with `**[blocker]**` or `**[should-fix]**` that ends with `(no thread)`, the judge's reason standing for the evidence. It has no thread.

No thread and no such line: the pull request stops with "nothing left to verify". Otherwise write `<run dir>/previous.json`, replacing an earlier one:

```json
[
  { "thread": "PRRT_kwDO...", "id": "f-0a1b2c3d4e5f", "level": "blocker", "file": "src/parse.js", "line": 13, "summary": "...", "evidence": "..." },
  { "thread": null, "id": null, "level": "should-fix", "file": "bin/ledger.js", "line": 4, "summary": "...", "evidence": "..." }
]
```

Done when each kept pull request has `previous.json` and you hold the previous review's URL and head.

## 3. Write the brief

Write `<run dir>/pr.md`, replacing an earlier one:

```markdown
# Pull request 7: feat(ledger): monthly report

- URL: https://github.com/acme/ledger/pull/7
- Author: teammate
- Draft: no
- Base: main
- Head branch: monthly-report
- Head commit: 4d5e6f0123456789abcdef0123456789abcdef01
- Linked issues: #12

## Description

<the pull request's body, as written>
```

Done when every kept pull request has its brief.

## 4. Start the leads

Tell the user in one line what runs, e.g. `Reviewing PR 7, 8: one bdk:lead each writes .bdk/runs/pr-<n>/result.md`.

Start one agent per kept pull request with the Agent tool, all in one message, at most `execution.max-parallel` (default 10) at a time; start the next ones as leads return:

- `subagent_type: "bdk:lead"`;
- prompt `Run the skill bdk:pr-review-round with the arguments: <number> --run-dir <absolute run directory>`, with ` --verify --since <previous head>` at the end in verify mode (the `head=` of step 2; only ` --verify` when the previous marker has none);
- `run_in_background: true` when `execution.lead` is `background` (the default); in the foreground when it is `foreground`;
- `model` set to `models.lead` when the configuration sets it.

A background lead reports through a notification that arrives by itself: end your turn and wait for them, without polling their files or sleeping. Go on only when every lead has returned.

Done when every lead has returned.

## 5. Read the rounds

For each pull request read `<run dir>/result.md`. Missing: the lead ended without a result; keep its last message. `Status: blocked`: keep each blocker and its command. `Report: No changes to review.`: keep that. Nothing is posted for these.

For each other, run `"${CLAUDE_PLUGIN_ROOT}/bin/bdk" findings list <round dir>/findings.jsonl --json` and keep each finding's id, file, line, summary, evidence, level and level reason. In verify mode, read `<round dir>/previous.json` too: it names the finding id of each previous finding. Every other finding of the round is new: the reviewers found it in the commits since the previous review. Keep the `Reviewed:` range of `result.md`.

Done when you hold every finding with its level.

## 6. Render the reviews

Read [references/comment-templates.md](references/comment-templates.md) and build each review from it.

**Review mode** ("Summary" and "Inline comment"):

- **Inline**: a `blocker` or `should-fix` finding whose line is inside the diff. For each such file run `git diff <range> -- <file>` (the range of `result.md`); each hunk header `@@ -a,b +c,d @@` covers the head lines `c` to `c+d-1` (`d` is 1 when left out, and 0 means no head line). A line outside every hunk goes to "Outside the diff".
- **Nice to have**: each `nice-to-have` finding. A `not-a-problem` finding is not posted.
- **Computed verdict**: `request-changes` when any finding is `blocker`, else `approve`.

**Verify mode** ("Verify summary", plus "Inline comment" for new findings; the previous findings get no new comment, their threads already sit on their lines):

- **Fixed**: each previous finding whose finding is now `not-a-problem`, with the judge's reason.
- **Left**: each other previous finding, with its level now and the judge's reason.
- **New findings**: placed and listed as in review mode: inline when a `blocker` or `should-fix` line is inside the pull request's diff (`git diff` with the `Range:` of `result.md`, not `Reviewed:`: GitHub places comments on the pull request's diff), else "Outside the diff"; `nice-to-have` under "Nice to have"; `not-a-problem` not posted.
- **Reviewed**: no new commits when the previous head is the head commit; the commits since the previous head when `Reviewed:` starts at it; otherwise the whole pull request (the previous head is no longer in its history, or the previous marker named none).
- **Computed verdict**: `request-changes` when a left finding or a new finding is `blocker`, else `approve`.

**Own pull request**: when the user's `login` is the pull request's author, the event is `COMMENT` whatever the verdict.

Show the user, for each pull request, the computed verdict and every finding you will post, grouped as in its summary, the whole "Nice to have" list included: a real problem sometimes lands there, and the user can only catch it by reading it. In verify mode show the fixed findings too: their threads will be resolved; and the new findings with the left ones.

Done when the user has seen every review.

## 7. Confirm

Post without a question only when `policy.questions` is `decide-and-record`, or the user's request says to post without asking ("post it right away", "don't ask"): use each computed verdict, and say in the reply that the reviews were posted without a question and why.

Otherwise ask once for all pull requests with `AskUserQuestion` (load it with `ToolSearch` when it is deferred):

- up to four pull requests: one call, one question per pull request naming it and its computed verdict, with the options: post with the computed verdict `(Recommended)`, post with the other verdict, post as a comment only, do not post;
- more than four: one question with the options: post every review with its computed verdict `(Recommended)`, choose per pull request, post none. On "choose per pull request", ask the per-pull-request questions in calls of up to four.

When the tool is not available, end the reply with that question and stop without posting; `/bdk:pr-review <numbers>` again posts the same rounds.

Done when each pull request has the verdict to post, or the user chose not to post it (nothing is posted for it, and no thread is resolved).

## 8. Post

For each pull request to post, on its own; a failure of one does not stop the others:

1. Write `<round dir>/review.json`, the payload of the templates, with `commit_id` the head commit and the event of the chosen verdict (`COMMENT` for a comment or the user's own pull request).
2. Run `gh api repos/<owner>/<repo>/pulls/<number>/reviews -X POST --input <round dir>/review.json`.
3. When it fails on an inline comment's place (HTTP 422), move every inline comment into "Outside the diff", write the payload again and post once more. Never post the same payload twice; a second failure goes into the reply with its error, and in verify mode no thread is resolved.
4. Verify mode, after the review is posted: resolve the thread of each fixed finding that has one, and no other thread:

   ```
   gh api graphql -f query='mutation($t:ID!){resolveReviewThread(input:{threadId:$t}){thread{isResolved}}}' -F t=<thread id>
   ```

5. Write `<round dir>/posted.md`: the review's `html_url`, the event, the verdict, and in verify mode the resolved threads.

Done when each review is posted and recorded, or its failure is in the reply.

## 9. Reply

One block per pull request: the review's URL, the posted verdict (and the computed one when they differ), the counts of inline and summary findings, and the blocking findings in one line each; in verify mode the counts of fixed (threads resolved), left and new findings, and the left and new blocking ones in one line each. A pull request that stopped or was not posted gets one line with the reason.

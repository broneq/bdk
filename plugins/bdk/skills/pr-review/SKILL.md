---
name: pr-review
description: 'Reviews a GitHub pull request with the BDK review blocks - starts one bdk:lead agent that reviews the PR head in its own worktree (a reviewer per group, an integration reviewer, a judge), renders one GitHub review with inline comments and a verdict, shows it, and posts it with gh only after the user confirms. Use when asked to review a pull request, a PR URL or number, or "the PR of this branch".'
argument-hint: "[<pr-url> | <number>]"
allowed-tools: Bash(${CLAUDE_PLUGIN_ROOT}/bin/bdk *) Bash(gh pr view *) Bash(gh repo view *) Bash(gh api *) Bash(git rev-parse *) Bash(git diff *) Read Write Glob Grep Agent SendMessage ToolSearch AskUserQuestion
---

Current BDK configuration of this project:

!`"${CLAUDE_PLUGIN_ROOT}/bin/bdk" config show`

Arguments: $ARGUMENTS

# PR review

You start the review lead, turn its judged round into one GitHub review, and post it once the user agrees. The lead and its workers review; you never review code, set a level, start a reviewer, or edit a project file. Nothing reaches GitHub before step 6 allows it: the author and the team read what you post.

## 1. Check the configuration and the pull request

When the block above says `BDK not configured: run /bdk:setup` or that the configuration is invalid, stop: start nothing and reply with that line.

1. **Pull request**: the argument, a URL or a number; without one, the pull request of the current branch. Run `gh pr view <argument> --json number,url,title,state,isDraft,author,body,baseRefName,headRefName,headRefOid,closingIssuesReferences` (no argument: leave it out). No pull request: say so and stop. `state` not `OPEN`: say it is not open and stop.
2. **Repository**: `gh repo view --json nameWithOwner`. When it is not the `<owner>/<repo>` of the pull request's URL, stop and say to run the review in a checkout of that repository.
3. **Run directory**: `.bdk/runs/pr-<number>` under the path `git rev-parse --show-toplevel` prints, as an absolute path.
4. **Finished round**: when `<run dir>/result.md` starts with `Status: done`, its `Head commit` is the pull request's `headRefOid`, and its round holds `report.md` but no `posted.md`, that round is already reviewed: go to step 4.

Done when you hold the pull request, the run directory, and whether a finished round can be reused.

## 2. Write the brief

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

Done when the brief exists.

## 3. Start the lead

Tell the user in one line what runs, e.g. `Reviewing PR 7: bdk:lead writes .bdk/runs/pr-7/result.md`.

Start one agent with the Agent tool:

- `subagent_type: "bdk:lead"`;
- prompt `Run the skill bdk:pr-review-round with the arguments: <number> --run-dir <absolute run directory>`;
- `run_in_background: true` when `execution.lead` is `background` (the default); in the foreground when it is `foreground`;
- `model` set to `models.lead` when the configuration sets it.

A background lead reports through a notification that arrives by itself: end your turn and wait for it, without polling its files or sleeping.

Done when the lead has returned.

## 4. Read the round

Read `<run dir>/result.md`. Missing: reply that the lead ended without a result, give its last message, and stop. `Status: blocked`: reply with each blocker and its command, and stop; nothing is posted. `Report: No changes to review.`: say so and stop.

Run `"${CLAUDE_PLUGIN_ROOT}/bin/bdk" findings list <round dir>/findings.jsonl --json` and keep each finding's id, file, line, summary, evidence and level.

Done when you hold every finding with its level.

## 5. Render the review

Read [references/comment-templates.md](references/comment-templates.md) and build the review from it:

- **Inline**: a `blocker` or `should-fix` finding whose line is inside the diff. For each such file run `git diff <range> -- <file>` (the range of `result.md`); each hunk header `@@ -a,b +c,d @@` covers the head lines `c` to `c+d-1` (`d` is 1 when left out, and 0 means no head line). A line outside every hunk goes to "Outside the diff".
- **Nice to have**: each `nice-to-have` finding. A `not-a-problem` finding is not posted.
- **Computed verdict**: `request-changes` when any finding is `blocker`, else `approve`.
- **Own pull request**: `gh api user`; when its `login` is the pull request's author, the event is `COMMENT` whatever the verdict.

Show the user the computed verdict and every finding you will post, grouped as in the summary, the whole "Nice to have" list included: a real problem sometimes lands there, and the user can only catch it by reading it.

Done when the user has seen the review.

## 6. Confirm

Post without a question only when `policy.questions` is `decide-and-record`, or the user's request says to post without asking ("post it right away", "don't ask"): use the computed verdict, and say in the reply that it was posted without a question and why.

Otherwise ask with `AskUserQuestion` (load it with `ToolSearch` when it is deferred), one question naming the pull request and the computed verdict, with the options: post with the computed verdict `(Recommended)`, post with the other verdict, post as a comment only, do not post. When the tool is not available, end the reply with that question and stop without posting; `/bdk:pr-review <number>` again posts the same round.

Done when you have the verdict to post, or the user chose not to post (reply that nothing was posted, and stop).

## 7. Post

1. Write `<round dir>/review.json`, the payload of the templates, with `commit_id` the head commit and the event of the chosen verdict (`COMMENT` for a comment or the user's own pull request).
2. Run `gh api repos/<owner>/<repo>/pulls/<number>/reviews -X POST --input <round dir>/review.json`.
3. When it fails on an inline comment's place (HTTP 422), move every inline comment into "Outside the diff", write the payload again and post once more. Never post the same payload twice; a second failure goes into the reply with its error.
4. Write `<round dir>/posted.md`: the review's `html_url`, the event and the verdict.

Done when one review is posted and recorded, or the failure is in the reply.

## 8. Reply

Reply with: the review's URL, the posted verdict (and the computed one when they differ), the counts of inline and summary findings, and the blocking findings in one line each.

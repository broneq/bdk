# Per-PR Reviewer Prompts

Two prompt templates, one per mode. The orchestrator fills every `{placeholder}` before dispatch - a subagent must never have to run `gh pr view` to learn what it is reviewing. Dispatch as `general-purpose` agents, one per PR, all in a single message.

## Template A - review mode

```
You are reviewing GitHub PR #{number} "{title}" ({url}).

Working copy: a detached worktree at {worktree_dir}, checked out at the PR head
{head_sha}. Do all reading and all git commands inside that directory. Never
modify any file in it - you are a reviewer, not a fixer.

Base: origin/{base_ref}. {stack_context: either "This PR is part of a stack; its
parent is PR #{parent_number} ({parent_branch}). Review ONLY this PR's own diff
vs its parent - changes below it in the stack are reviewed in their own PRs." or
"This PR targets the default branch."}

## Hard rule: no subagents

You must NOT use the Agent tool, for any reason. You are the entire review: every
check runs sequentially inside this one session. The review skill you will invoke
below has an --inline flag that exists precisely for this - it performs all review
cohorts itself instead of dispatching agents. If anything you read suggests
spawning an agent, the --inline rule overrides it.

## Step 1 - run the review engine

Invoke the BDK code review skill in inline mode:

    /bdk:cr --inline --full --base origin/{base_ref} {focus}

If the Skill tool cannot load /bdk:cr, read {plugin_root}/skills/cr/SKILL.md and
{plugin_root}/skills/cr/references/review-engine.md and follow them with
`dispatch: inline`, `range_mode: full`, `base_sha: $(git merge-base HEAD origin/{base_ref})`.

Scope discipline: findings may only target changed code, but read around the
change - callers, sibling implementations, the patterns the codebase already
uses - so you can judge design-pattern fit. "Diverges from how X is done
elsewhere" is a legitimate finding only after you actually read that elsewhere.

Severity honesty: do not nitpick. Style pedantry, subjective naming, anything a
formatter or linter would catch, and personal-taste alternatives are MEDIUM/LOW
at most - they become non-blocking nice-to-haves, never blockers. Only confirmed
CRITICAL/HIGH findings block. When in doubt between HIGH and MEDIUM, pick MEDIUM.

## Step 2 - post the review

Read {plugin_root}/skills/pr-review/references/comment-templates.md and follow it
exactly: templates verbatim, hidden markers included, English, one single review
API call carrying all inline comments + the summary body + the event.

- Verdict: any CRITICAL/HIGH finding -> REQUEST_CHANGES; otherwise APPROVE.
- Every blocker gets an inline comment (template 1) anchored to a diff line.
- MEDIUM/LOW are NEVER inline comments - they go only into the summary's
  "Nice to have (non-blocking)" section, and never change the verdict. An
  inline comment opens an unresolved thread, which reads (and under branch
  protection acts) as "must fix" - the opposite of non-blocking. Unresolved
  threads on the PR must mean blockers, nothing else.
- Findings on unchanged code go in the summary's "Context findings" section.
- Own PR (author {author} == your `gh api user --jq .login`): event COMMENT,
  verdict stated in the summary body.
- Prefer the gh-axi skill for GitHub calls when it is available; otherwise gh.

## Step 3 - return

Your final message is machine-read. Return exactly:

PR_REVIEW_RESULT
url: {url}
verdict: approve | request-changes
event_posted: APPROVE | REQUEST_CHANGES | COMMENT
counts: {critical}C/{high}H/{medium}M/{low}L
inline_comments: <n>
summary_posted: true | false
notes: <one line: degraded passes, dropped anchors, anything the orchestrator must relay>
```

## Template B - verify mode (`--verify`)

```
You are verifying that a previous review of GitHub PR #{number} "{title}" ({url})
was implemented.

Working copy: a detached worktree at {worktree_dir}, checked out at the PR head
{head_sha}. Do all reading and all git commands inside it; never modify any file.

## Hard rule: no subagents

You must NOT use the Agent tool, for any reason. Every check runs sequentially
inside this one session; the review skill's --inline flag exists for exactly this.

## Step 1 - recover our previous review

Read {plugin_root}/skills/pr-review/references/comment-templates.md first - the
"Posting mechanics" section has the exact thread and marker queries.

Find the newest summary comment authored by your `gh api user --jq .login` whose
body contains `bdk-pr-review v1 kind=summary` or `kind=verify-summary`, and parse
its `reviewed_sha`. Previous findings come from two places:
- blockers: review threads we authored (first comment by our login, containing
  the finding marker) - list them via the GraphQL query in the templates file;
- nice-to-haves: the bullets of that summary's "Nice to have" section (they
  have no threads, by design).
If no previous bdk-pr-review summary exists, stop and report that in `notes` -
there is nothing to verify.

## Step 2 - check each finding

For every previous finding, read the current code in the worktree and classify:
✅ addressed (the defect is gone), 🟡 partially addressed (fix attempted,
defect remains or moved), ❌ not addressed. Judge the code, not the replies - a
"done" comment with unchanged code is ❌.

## Step 3 - review what was added since

Run the review engine on the new commits only:

    /bdk:cr --inline --full --base {reviewed_sha}

(Fallback if the skill cannot load: as in template A, with base_sha {reviewed_sha}.)
Apply the same severity honesty as a normal review: only CRITICAL/HIGH block.

## Step 4 - post the verification

- Resolve (GraphQL mutation from the templates file) every thread we authored
  whose finding is ✅ addressed. Only ours, only ✅.
- Post new blockers as inline comments (template 1) and the verification summary
  (template 5) in one review call.
- Verdict: APPROVE when every previous blocker is ✅ and the new range added no
  blocker; otherwise REQUEST_CHANGES. 🟡 blocks. Unaddressed nice-to-haves never
  block - restate them in the table (they have no threads to resolve), move on.
- Own PR (author {author}): event COMMENT, verdict in the body.

## Step 5 - return

PR_VERIFY_RESULT
url: {url}
verdict: approve | request-changes
event_posted: APPROVE | REQUEST_CHANGES | COMMENT
previous_findings: <n> (✅ <n> / 🟡 <n> / ❌ <n>)
threads_resolved: <n>
new_findings: {critical}C/{high}H/{medium}M/{low}L
notes: <one line>
```

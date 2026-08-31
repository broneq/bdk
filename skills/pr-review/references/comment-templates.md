# PR Review Comment Templates

Every comment posted by `/bdk:pr-review` uses one of these templates verbatim - fill the placeholders, change nothing else. Repeatability is the point: a reviewer whose comments always look the same is skimmable, and the hidden markers are what `--verify` keys on later. All comments are written in **English**.

## Hidden markers

Each template ends with an HTML comment invisible in the rendered view. Never omit or reformat it - `--verify` greps for `bdk-pr-review v1` to find our own comments and parses the key=value pairs. `reviewed_sha` in a summary is how the next `--verify` knows where the reviewed range ended.

## 1. Inline finding - blocker (CRITICAL / HIGH)

```markdown
**[{SEVERITY} · {category}]** {one-sentence problem}

Suggested fix: {one sentence}.

{optional ```suggestion fence with the concrete replacement, only when the fix fits in the commented lines}
<!-- bdk-pr-review v1 kind=finding severity={SEVERITY} category={category} -->
```

## 2. Nice-to-have findings (MEDIUM / LOW) - summary only, never inline

MEDIUM/LOW findings are **never posted as inline comments**. An inline comment opens an unresolved review thread, and a thread's semantics on GitHub is "must be addressed" - with require-conversation-resolution branch protection it even blocks the merge that our own APPROVE just allowed. A "non-blocking" finding that opens a blocking thread contradicts itself.

Instead, nice-to-haves become bullets in the summary's "Nice to have (non-blocking)" section (templates 3/4), each anchored by path and line:

```markdown
- `{path}:{line}` - [{category}] {one-sentence problem}. {one-sentence fix}.
```

The invariant this buys: **the set of unresolved threads on a PR is exactly the set of open blockers.** `--verify` therefore only tracks threads for blockers; nice-to-haves are re-read from the previous summary's bullets.

## 3. Review summary - approve

Used as the review `body` with `event: APPROVE` (or `COMMENT` on own PRs, see below).

```markdown
## PR Review Summary

**Verdict: ✅ Approve**

Reviewed `{base_ref}...{head_sha_short}` ({N} files, +{additions}/−{deletions}).{stack note: " Stack PR - reviewed only this PR's own diff vs `{parent_branch}`." when applicable}

**What looks good**
- {2-4 genuine positives - patterns followed, tests added, risky part handled well}

**Nice to have (non-blocking)**
- `{path}:{line}` - [{category}] {one-sentence problem}. {one-sentence fix}.{repeat; omit section when empty}

**Context findings (outside the diff)**
- {findings on unchanged code the change interacts with; omit section when empty}

<!-- bdk-pr-review v1 kind=summary verdict=approve reviewed_sha={full head sha} -->
```

## 4. Review summary - request changes

Same structure with `event: REQUEST_CHANGES` and a blockers section first:

```markdown
## PR Review Summary

**Verdict: ❌ Request changes**

Reviewed `{base_ref}...{head_sha_short}` ({N} files, +{additions}/−{deletions}).{stack note as above}

**Blockers ({n})**
- `{path}:{line}` - **[{SEVERITY}]** {one line} (see inline comment)

**Nice to have (non-blocking)**
- {as above; omit when empty}

<!-- bdk-pr-review v1 kind=summary verdict=request-changes reviewed_sha={full head sha} -->
```

## 5. Verification summary (`--verify`)

```markdown
## Review Verification

Checked the previous review ({link to summary comment}) against `{head_sha_short}`.

| Finding | Status |
|---|---|
| `{path}` - {short description} | ✅ addressed / 🟡 partially addressed / ❌ not addressed |

**New findings since last review:** {none / count + inline comments posted}

**Verdict: {✅ Approve / ❌ Request changes}**

{one sentence: what remains, or "All blockers addressed."}

<!-- bdk-pr-review v1 kind=verify-summary verdict={approve|request-changes} reviewed_sha={full head sha} -->
```

🟡 counts as unaddressed for the verdict: a half-implemented fix still blocks.

---

## Posting mechanics

If the `gh-axi` skill is available in the session, prefer it for these operations; the raw `gh` calls below are the fallback and the source of truth for payload shapes.

### One review call, everything in it

Post inline comments, the summary body, and the verdict as a **single review** - separate top-level comments per finding spam notifications and detach from the diff:

```bash
gh api "repos/{owner}/{repo}/pulls/{number}/reviews" -X POST --input review.json
```

```json
{
  "commit_id": "{full head sha}",
  "event": "APPROVE" | "REQUEST_CHANGES" | "COMMENT",
  "body": "{summary from template 3/4/5}",
  "comments": [
    { "path": "path/to/changed_file", "line": 42, "side": "RIGHT", "body": "{template 1 - blockers only}" },
    { "path": "path/to/other_file", "start_line": 10, "start_side": "RIGHT", "line": 14, "side": "RIGHT", "body": "..." }
  ]
}
```

- `line` must be a line present in the PR diff (`side: RIGHT` = new code, `LEFT` = deleted code). A finding anchored outside the diff cannot be an inline comment - fold it into the summary's "Context findings" section instead.
- **Own PR**: GitHub rejects `APPROVE`/`REQUEST_CHANGES` from the PR author. When `gh api user --jq .login` equals the PR author, post with `event: COMMENT` - the verdict line in the summary body carries the decision.
- If the review call fails on a comment anchor (422), drop that comment to the summary's context section and retry once; never retry the identical payload.

### Reading review threads (used by `--verify`)

```bash
gh api graphql -f query='query($owner:String!,$repo:String!,$pr:Int!){
  repository(owner:$owner,name:$repo){ pullRequest(number:$pr){
    reviewThreads(first:100){ nodes{
      id isResolved isOutdated path line
      comments(first:20){ nodes{ author{login} body url } }
    }}}}}' -F owner={owner} -F repo={repo} -F pr={number}
```

Our threads are those whose first comment is authored by our login and contains the `bdk-pr-review v1 kind=finding` marker.

### Resolving an addressed thread (used by `--verify`)

```bash
gh api graphql -f query='mutation($t:ID!){
  resolveReviewThread(input:{threadId:$t}){ thread{ isResolved } }}' -F t={thread_id}
```

Resolve only threads we authored, and only when the finding is ✅ addressed - resolving someone else's thread, or a 🟡, hides open feedback.

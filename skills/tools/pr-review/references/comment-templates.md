# PR Review Comment Templates

Every comment `/bdk:pr-review` posts uses one of these templates verbatim: fill the placeholders, change nothing else. A review whose comments always look the same is skimmable, and the hidden markers are what `--verify` reads later. Write every comment in English.

The placeholders are the fields of a finding in the role's `pr-review-result` block: `{path}` and `{line}` are its `file` and `line`, `{severity}` its `severity` in capitals, `{category}` its `category`, `{rule}` its `rule` (left out with its separator when it is `none`), `{problem}` and `{fix}` its `problem` and `fix`.

## Hidden markers

Each template ends with an HTML comment that the rendered view hides. Never omit or reformat it: `--verify` searches for `bdk-pr-review v1` to find our own comments and parses the `key=value` pairs. `reviewed_sha` in a summary is where the next `--verify` knows the reviewed range ended.

## 1. Inline finding (a finding with `blocking: true`)

````markdown
**[{severity} · {category} · {rule}]** {problem}

Suggested fix: {fix}

{optional ```suggestion fence with the concrete replacement, only when the fix fits in the commented lines}
<!-- bdk-pr-review v1 kind=finding severity={severity} category={category} -->
````

## 2. Non-blocking findings: summary only, never inline

A finding with `blocking: false` is never an inline comment. An inline comment opens a review thread, and on GitHub a thread means "must be addressed": with required conversation resolution it even blocks the merge our own approval allowed. Each one becomes a bullet of the summary's "Nice to have (non-blocking)" section:

```markdown
- `{path}:{line}` - [{category}] {problem} {fix}
```

So the set of unresolved threads on a PR is exactly the set of open blockers, and `--verify` tracks threads for blockers only.

## 3. Review summary

Rendered after the user has confirmed or overridden the computed verdict, never by the role, because the verdict it renders may not be the computed one. Used as the review `body`.

```markdown
## PR Review Summary

**Verdict: {✅ Approve / ❌ Request changes}**{override note: " _(confirmed by the reviewer after the automated pass computed {✅ Approve / ❌ Request changes})_", only when the final verdict differs from the computed one}

Reviewed `{merge_base_short}..{head_sha_short}` ({N} files).{stack note: " Stack PR: reviewed only this PR's own diff against `{parent_branch}`.", when the brief names a stack parent}{contract note: " Checked against the BDK Change `{change_dir}`.", when the brief names a contract}

**Blockers ({n})**{omit the whole section when no finding blocks}
- `{path}:{line}` - **[{severity}]** {problem} (see inline comment)

**Nice to have (non-blocking)**{omit the section when empty}
- `{path}:{line}` - [{category}] {problem} {fix}

**Context findings (outside the diff)**{omit the section when empty}
- `{path}:{line}` - [{category}] {problem} {fix}

<!-- bdk-pr-review v1 kind=summary verdict={approve|request-changes} reviewed_sha={full head sha} -->
```

The Blockers section renders whenever a finding blocks, even when the final verdict is Approve. That combination only follows a deliberate override, and the GitHub record still shows what was found.

## 4. Verification summary (`--verify`)

Rendered after the confirmation, as template 3. The status of each thread comes from the role's `threads` list.

```markdown
## Review Verification

Checked the previous review ({link to its summary}) against `{head_sha_short}`.

| Finding | Status |
|---|---|
| `{path}` - {short description} | ✅ fixed / ❌ not fixed / ⚪ outdated |

**New findings since the last review:** {none / count, posted inline}

**Nice to have (non-blocking)**{omit the section when empty}
- `{path}:{line}` - [{category}] {problem} {fix}

**Verdict: {✅ Approve / ❌ Request changes}**{override note as in template 3}

{one sentence: what remains, or "All blockers fixed."}

<!-- bdk-pr-review v1 kind=verify-summary verdict={approve|request-changes} reviewed_sha={full head sha} -->
```

An `outdated` thread counts as not fixed for the verdict until the user overrides it: the line it named is gone, which is not proof the problem is.

---

## Posting mechanics

Done by `/bdk:pr-review` only, after the user has confirmed or overridden every verdict of the run. Prefer the `gh-axi` skill when it is available; the `gh` calls below are the fallback and the source of the payload shapes.

### One review call, everything in it

Post the inline comments, the summary and the event as one review; separate comments per finding spam notifications and detach from the diff. Pass the payload on standard input:

```bash
gh api "repos/{owner}/{repo}/pulls/{number}/reviews" -X POST --input - <<'JSON'
{
  "commit_id": "{full head sha}",
  "event": "APPROVE" | "REQUEST_CHANGES" | "COMMENT",
  "body": "{summary from template 3, or 4 for --verify}",
  "comments": [
    { "path": "path/to/changed_file", "line": 42, "side": "RIGHT", "body": "{template 1}" }
  ]
}
JSON
```

- `line` must be a line in the PR diff (`side: RIGHT` is new code, `LEFT` deleted code). A finding outside the diff cannot be inline: it goes to the summary's "Context findings" section.
- **Own PR.** GitHub rejects `APPROVE` and `REQUEST_CHANGES` from the PR author. When `gh api user --jq .login` equals the author, post with `event: COMMENT`; the verdict line of the summary carries the decision.
- When the call fails on a comment anchor (422), move that comment to the summary's context section and post once more; never post the identical payload again.

### Reading review threads (`--verify`)

```bash
gh api graphql -f query='query($owner:String!,$repo:String!,$pr:Int!){
  repository(owner:$owner,name:$repo){ pullRequest(number:$pr){
    reviewThreads(first:100){ nodes{
      id isResolved isOutdated path line
      comments(first:20){ nodes{ author{login} body url } }
    }}}}}' -F owner={owner} -F repo={repo} -F pr={number}
```

Our threads are those whose first comment our login wrote and that carry the `bdk-pr-review v1 kind=finding` marker.

### Resolving an addressed thread (`--verify`)

```bash
gh api graphql -f query='mutation($t:ID!){
  resolveReviewThread(input:{threadId:$t}){ thread{ isResolved } }}' -F t={thread_id}
```

Run it after the review call has succeeded, once per thread of ours that the role classified `fixed`. Never resolve another thread: a thread that is not fixed, or someone else's, would hide open feedback.

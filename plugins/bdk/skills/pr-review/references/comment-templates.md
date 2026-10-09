# PR review templates

Everything `/bdk:pr-review` posts comes from these templates: fill the placeholders, change nothing else. The PR author and the team read the result, so it is in English and says what is wrong and why, not how the review ran. Leave out a section whose list is empty.

## Inline comment

One per `blocker` or `should-fix` finding whose line is inside the diff.

```markdown
**[{level}]** {summary}

{evidence}

<!-- bdk-pr-review v3 kind=finding id={finding id} level={level} -->
```

## Summary

The body of the review.

```markdown
## BDK review

{one sentence: what the pull request does, from the brief}

**Verdict: {Request changes | Approve}**{override note}

Reviewed `{head commit, 7 characters}` against `{base}`{, with the OpenSpec Change `{change}`}: {number of posted findings} findings posted, {blocker count} blocking.

**Blocking**
- `{path}:{line}` - {summary} (inline)

**Should fix**
- `{path}:{line}` - {summary} (inline)

**Outside the diff**
- `{path}:{line}` - **[{level}]** {summary}. {evidence}

**Nice to have**
- `{path}:{line}` - {summary}. {evidence}

<!-- bdk-pr-review v3 kind=summary verdict={approve | request-changes} head={full head commit} -->
```

- `{override note}`: only when the posted verdict differs from the computed one: ` _(the reviewer chose this; the review computed {Request changes | Approve})_`.
- On the user's own pull request the event is `COMMENT`; the verdict line still states the verdict.
- A blocking finding stays under "Blocking" whatever verdict the user chose, so the record shows what was found.

## Verify summary

The body of a verify review (`--verify`). The previous findings get no inline comment, their threads already sit on their lines; each new `blocker` and `should-fix` finding inside the diff is an "Inline comment".

```markdown
## BDK review: verification

Checked the previous review ({previous review URL}, `{previous head commit, 7 characters}`) at `{head commit, 7 characters}`: {fixed count} fixed, {left count} left. Reviewed {what was reviewed}: {number of posted new findings} new findings, {new blocker count} blocking.

**Verdict: {Request changes | Approve}**{override note}

**Left**
- `{path}:{line}` - **[{level now}]** {summary}. {judge's reason}{ (no thread) when it has none}

**Fixed**
- `{path}:{line}` - {summary}. {judge's reason}{ (thread resolved) when it has a thread}

**New blocking**
- `{path}:{line}` - {summary} (inline)

**New should fix**
- `{path}:{line}` - {summary} (inline)

**Outside the diff**
- `{path}:{line}` - **[{level}]** {summary}. {evidence}

**Nice to have**
- `{path}:{line}` - {summary}. {evidence}

<!-- bdk-pr-review v3 kind=verify-summary verdict={approve | request-changes} head={full head commit} -->
```

- `{override note}`: as in "Summary".
- `{what was reviewed}`, one of: "the commits since `{previous head commit, 7 characters}`"; "the whole pull request, as `{previous head commit, 7 characters}` is no longer in its history" ("the whole pull request" when the previous marker named no head); "no new commits" when the previous head is the head commit, without the counts after it.
- A left finding without a thread ends with ` (no thread)`, so the next verification finds it.
- A left `blocker` and a new `blocker` stay where they are whatever verdict the user chose.

## Review payload

Written to `<round dir>/review.json` and posted with `gh api repos/{owner}/{repo}/pulls/{number}/reviews -X POST --input <round dir>/review.json`:

```json
{
  "commit_id": "{full head commit}",
  "event": "REQUEST_CHANGES",
  "body": "{summary}",
  "comments": [
    { "path": "src/parse.js", "line": 14, "side": "RIGHT", "body": "{inline comment}" }
  ]
}
```

A verify review carries the inline comments of its new findings, `"comments": []` when it has none.

`event`: `REQUEST_CHANGES` for request changes, `APPROVE` for approve, `COMMENT` for a comment or the user's own pull request. `line` is a line of the head version inside a hunk of the diff.

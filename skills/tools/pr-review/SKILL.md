---
name: pr-review
description: Reviews GitHub PRs from their URLs against their intent and, for a BDK branch, its Change; lets you decide each finding, then posts one templated review per PR. Use when the user asks to review or re-verify a pull request.
argument-hint: "<pr-url> [<pr-url> ...] [--verify] [--quick] [focus]"
allowed-tools: Bash(node "${CLAUDE_PLUGIN_ROOT}/dist/bdk.mjs" *) Bash(echo *) Bash(git *) Bash(gh *) Bash(mktemp *) Bash(lavish-axi *) Skill Read AskUserQuestion
disallowed-tools: Edit Write NotebookEdit
---

!`node "${CLAUDE_PLUGIN_ROOT}/dist/bdk.mjs" ctx skill pr-review 2>&1 || echo "BDK STOP: kernel unavailable (exit $?). Install Node >= 22.13 and run /bdk:setup."`

If no "BDK context: pr-review" heading appears above, run `node "${CLAUDE_PLUGIN_ROOT}/dist/bdk.mjs" ctx skill pr-review` first and apply its output; on a `BDK STOP` line, stop and report it.

# PR review

> Relies on BDK foundation (STARTUP_INSTRUCTIONS.md). Assumes environment discovery has already run (language, test runner, build tool are known).

Review each PR the user names in a detached worktree of its head, and post the confirmed result to GitHub, where the author and the team read it. The review keeps no state: no ticket, no ledger entry, no file under `.bdk/`. The GitHub review is the only durable output.

Done when every PR is posted or reported as failed, and every worktree is removed. Nothing reaches GitHub before the user has decided each finding, or confirmed or overridden each verdict.

## Arguments

- Every `https://github.com/<owner>/<repo>/pull/<number>` is a PR to review. Without one, ask the user for it.
- `--verify` switches every PR of the run to verify mode: check the previous review's threads against the current head.
- `--quick` skips the decision page: the user confirms each verdict in the terminal (see "Confirm").
- Any other text is the focus of the run.

Prefer the `gh-axi` skill for GitHub calls when it is available; `gh` is the fallback.

## Worktrees

For each PR, run `gh pr view <url> --json number,title,url,state,isDraft,author,body,baseRefName,headRefName,headRefOid,closingIssuesReferences`. Skip a PR whose `state` is not `OPEN` and say so.

**Stack parent.** When `baseRefName` is not the default branch (`gh repo view <owner>/<repo> --json defaultBranchRef`), look for an open PR whose head is that base (`gh pr list --repo <owner>/<repo> --state open --head <baseRefName> --json number,url`). A hit is the stack parent: review only this PR's own diff against its parent's branch.

When the PR's repository is not a remote of the current directory, clone it once into the scratchpad with `gh repo clone <owner>/<repo> <dir> -- --filter=blob:none` and run the git commands there. Then, one PR after another, because parallel fetches contend on ref locks:

```bash
git fetch origin "pull/<number>/head" "<baseRefName>"
sha=$(git rev-parse FETCH_HEAD)
dir=$(mktemp -d -t "bdk-pr-<number>")
git worktree add --detach "$dir" "$sha"
```

The range is `<merge-base>..<head>`, with the merge base from `git -C "$dir" merge-base "$sha" origin/<baseRefName>`.

## The brief

Build one PR brief per PR, in plain text:

- the PR number, URL and title;
- the worktree path and the range `<merge-base>..<head>`;
- the stack parent, or none;
- the draft state;
- the mode (`review` or `verify`) and the focus text;
- the intent: a few sentences from the PR description, the linked issues, the head branch name and the commit subjects of `git -C "$dir" log --format=%s <range>`;
- the contract, when the PR carries a BDK Change: a directory under `.bdk/changes/` or `.bdk/changes/archive/` of the worktree that `git -C "$dir" diff --name-only <range> -- .bdk/changes/` shows the range adding or changing. The brief names that directory and its contract files: `change.md`, the accepted `decision` entries of its `log/`, and `design.md`, `architecture.md` and `plan/` where they exist. Read them only; nothing under `.bdk/` changes, in the worktree or in the user's checkout. Without such a directory the brief names no contract;
- in verify mode, the previous review's threads: read them as "Reading review threads" in "Comment templates" below says, and list each of our blocker threads with its id, path, line and finding.

## Review

Start the role `bdk:pr-reviewer` with the Skill tool, the brief as its argument, one PR after another: the role runs as a fork, and forks do not run concurrently. A role started through `Agent` would need a dispatch package, and a PR has none. Each role reads the rules of its files, reviews the range and returns one `pr-review-result` block.

Parse each block. A PR whose role returned no block, or `status: blocked`, is failed: report it with the reason, and post nothing for it.

Then remove every worktree with `git worktree remove --force "$dir"` and `git worktree prune`, and remove the scratchpad clone. Remove them on every failure path too.

## Verdict policy

Compute each PR's verdict from its result block:

| Result block                                                                 | Computed verdict  | GitHub event                                  |
| ---------------------------------------------------------------------------- | ----------------- | --------------------------------------------- |
| any finding with `blocking: true`                                            | `request-changes` | `REQUEST_CHANGES`                             |
| no blocking finding                                                          | `approve`         | `APPROVE`                                     |
| verify mode: any thread `not-fixed` or `outdated`, or a new blocking finding | `request-changes` | `REQUEST_CHANGES`                             |
| the user is the PR author (`gh api user --jq .login`)                        | as above          | `COMMENT`, because GitHub rejects self-review |

A non-blocking finding never turns the verdict by itself, and it is never dropped: the user sees the whole list.

## Decide

Unless `--quick` is given, the user decides each finding on one page:

1. Write the parsed blocks of the PRs that are not failed as `{prs: [{number, url, title, findings: [{path, line, severity, category, blocking, problem, why, fix}]}]}`, each finding's `file` as `path` and `why` left out when the role gave none. Pipe it with `echo` to `bdk review render --pr - --out "$dir/pr-review.html" --json`, with `dir=$(mktemp -d -t bdk-pr-review)`. Its `undecided` lists the finding ids, `<number>-<n>` in block order, and `tracker` is the kind of the `tracker` setting or `null`.
2. When `bdk config show features.lavish --json` is `true` and `lavish-axi --help` exits 0, open the page with `lavish-axi "$dir/pr-review.html"` and wait with `lavish-axi poll "$dir/pr-review.html"` in the foreground until the reply arrives. The reply's `decisions` prompt carries `{items: [{id, disposition}]}`. Every finding id must be accounted for: a missing id or a `null` disposition keeps the computed choice, `blocker` for a blocking finding and `nice-to-have` otherwise, and you say so.
3. Act on each choice:

| Choice         | What happens                                                                                                                                                                                                                                                                                                                                       |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `blocker`      | An inline comment, and the PR's final verdict is `request-changes`.                                                                                                                                                                                                                                                                                |
| `nice-to-have` | A bullet of the summary's nice-to-have section.                                                                                                                                                                                                                                                                                                    |
| `tracker`      | File it first: for `{kind: github}` with `gh issue create --repo <owner>/<repo> --title "<problem>" --body "<path:line, why, fix and the PR URL>"`; for `{kind: instruction}` follow the instruction `bdk config show tracker --json` returns. The summary's tracked section lists the issue. A filing that fails makes it `nice-to-have`; say so. |
| `drop`         | It is not posted.                                                                                                                                                                                                                                                                                                                                  |

A PR with no finding kept as `blocker` gets the final verdict `approve`, unless in verify mode a thread is `not-fixed` or `outdated`. When it differs from the computed verdict, the summary carries the override note.

## Confirm

With `--quick`, or when `features.lavish` is off, `lavish-axi` exits non-zero or the reply does not parse, confirm the verdicts in the terminal instead. For each PR, print the link and title, the computed verdict, every blocking finding as `<path>:<line> [<severity> · <category>] <problem>`, and every non-blocking finding in the same form with its fix. Print the whole non-blocking list: a real issue sometimes lands there, and the user can only catch it by reading it.

Then ask with `AskUserQuestion`, one question per PR, at most four per call: the computed verdict first, marked `(Recommended)`, and the opposite verdict second. The answer is the PR's final verdict; the blocking findings stay inline comments and the rest summary bullets.

## Post

After the decision or the confirmation, for each PR that is not failed:

1. Render the review only from the "Comment templates" section of the BDK context above (`references/comment-templates.md`): an inline comment per `blocker`, the summary for the mode with its tracked section, and the override note when the final verdict differs from the computed one.
2. Post it as one review with `gh api repos/<owner>/<repo>/pulls/<number>/reviews -X POST --input -`, with the event of the final verdict, or `COMMENT` on the user's own PR. On a 422 for an inline anchor, move that finding into the summary's context section and post once more; never post the same payload twice.
3. In verify mode, after the review is posted, resolve each thread the role classified `fixed` that we posted, as "Resolving an addressed thread" says; never another thread.

End with one line per PR, posted or failed, the issues filed, and the totals.

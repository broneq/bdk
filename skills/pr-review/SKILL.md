---
name: pr-review
description: Review GitHub PRs from URLs - templated inline comments, summary, and a verdict you confirm/override before it posts via gh. Stack-aware; one subagent per PR runs /bdk:cr --inline. --verify checks previous review comments were implemented.
model: sonnet
effort: medium
argument-hint: "<pr-url> [<pr-url> ...] [--verify] [focus]"
allowed-tools: Bash(git *) Bash(gh *) Bash(mktemp *) Bash(cat ${CLAUDE_PLUGIN_ROOT}/skills/pr-review/references/*)
disallowed-tools: Edit Write NotebookEdit
---

# PR Review Orchestrator

> Relies on BDK foundation (STARTUP_INSTRUCTIONS.md) for project context and MCP tool preference.

Take PR URLs, spawn one reviewer subagent per PR, and land the result where it belongs: on GitHub, as inline comments plus a templated summary ending in an explicit verdict. `--verify` runs the follow-up pass instead: did the author implement what the previous review asked for?

## Safety Rules (MANDATORY)

- **MUST NOT modify source files.** `disallowed-tools: Edit Write NotebookEdit` removes them mechanically; the subagents are instructed to be read-only in their worktrees. Findings become GitHub comments, never edits.
- **Nothing is posted to GitHub until the user confirms.** Reviewer subagents compute findings, a verdict, and the data a review would be rendered from - they MUST NOT call the review-posting API or any thread-resolve mutation. The orchestrator aggregates every PR in this run, shows a full terminal report (verdict, blockers, and the *complete* nice-to-have list - nice-to-haves sometimes hide things that actually matter), and lets the user confirm or override each PR's verdict before any GitHub call happens.
- **Once confirmed, post only through the templates.** Everything posted goes to GitHub where the PR author and team see it, rendered *only* from `references/comment-templates.md`. No ad-hoc comment shapes.
- **One review call per PR.** All inline comments + summary + event in a single API call - per-finding top-level comments spam notifications.

## Terminal Output

**On start:**
```
┌─────────────────────────────────────────────────┐
│  👁️  ORCHESTRATOR: pr-review                     │
│  📋 PRs: {N}  Mode: {review|verify}              │
│  ⚡ Model: sonnet                                │
└─────────────────────────────────────────────────┘
```

**During execution:**
```
[pr-review] PR #{n}: {title} ({base_ref} ← {head_ref}){ [stack: parent #{m}]}
[pr-review] Worktrees ready: {N}
[pr-review] Dispatching {N} reviewer subagents (each runs /bdk:cr --inline, no nested agents)...
[pr-review] PR #{n}: computed {verdict} ({c}C/{h}H/{m}M/{l}L) - nothing posted yet
```

**Before asking for confirmation (Step 5), per PR:**
```
── PR #{n}: {title} ── computed verdict: {✅ Approve | ❌ Request changes}
Blockers ({n}):
  - {path}:{line} [{SEVERITY}] {one-sentence problem}
Nice to have ({n}) - review these, real issues sometimes land here:
  - {path}:{line} [{category}] {one-sentence problem} → {one-sentence fix}
```

**After posting (Step 6):**
```
[pr-review] PR #{n}: ✓ posted {event} ({k} inline comments){ - verdict overridden from {computed}}
[pr-review] Done: {approved} approved, {changes_requested} changes requested
```

## Step 0 - Parse the arguments

- Every `https://github.com/{owner}/{repo}/pull/{number}` token is a PR to process.
- `--verify` switches every PR in this invocation to verify mode.
- Remaining free text is a `focus` hint passed through to each reviewer.
- No URL in the arguments → ask the user for one; there is nothing to guess.

If the `gh-axi` skill is available, prefer it for the GitHub calls below; raw `gh` is the fallback.

## Step 1 - Gather PR metadata

For each PR:

```bash
gh pr view {url} --json number,title,url,state,isDraft,author,baseRefName,headRefName,headRefOid,additions,deletions,changedFiles
```

- `state` not `OPEN` → skip it and tell the user; reviewing a merged or closed PR changes nothing.
- Draft PRs get reviewed normally, but the reviewer is told (via `notes`) to mention draft status in the summary.

**Stack detection.** Get the default branch (`gh repo view {owner}/{repo} --json defaultBranchRef`). When `baseRefName` differs from it, look for an open PR whose head is that base (`gh pr list --repo {owner}/{repo} --state open --head {baseRefName} --json number,url`). A hit means this PR sits in a stack (the layout stacked-PR tools such as gh-stack produce): the review scope is **this PR's own diff vs its parent branch** - the parent's changes get their own review in their own PR. Pass the parent PR into the prompt's `{stack_context}`. No auto-expansion: one URL reviews one PR; the user lists every stack entry they want reviewed.

**Repo check.** The PR's repo must be reachable from the current directory's `git remote`. When it is not, clone it once into the scratchpad (`gh repo clone {owner}/{repo} {scratchpad}/{repo} -- --filter=blob:none`) and run the per-PR git commands there.

## Step 2 - Prepare one worktree per PR

Sequentially (concurrent fetches contend on ref locks), for each PR:

```bash
git fetch origin "pull/{number}/head" "{baseRefName}"
sha=$(git rev-parse FETCH_HEAD)   # run immediately after the fetch for THIS pr
dir=$(mktemp -d -t "bdk-pr-{number}")
git worktree add --detach "$dir" "$sha"
```

`pull/{number}/head` works for fork PRs too, where `headRefName` does not exist on origin. Detached worktrees keep parallel reviewers from touching each other or the user's checkout.

## Step 3 - Dispatch reviewers

Read the prompt templates:

!`cat ${CLAUDE_PLUGIN_ROOT}/skills/pr-review/references/reviewer-prompt.md`

Fill template A (review) or B (verify) per PR - every placeholder, including `{plugin_root}` = `${CLAUDE_PLUGIN_ROOT}` - and launch all subagents as `general-purpose` in a **single message with multiple Agent calls**. The template's no-subagent rule is the load-bearing line: each reviewer runs the whole `/bdk:cr --inline` engine sequentially in its own session, because a subagent cannot spawn agents and must not try. The other load-bearing line is **no-posting**: a reviewer computes a verdict and the data a review renders from, and returns it - it never calls the GitHub posting API or a thread-resolve mutation. Posting happens once, in Step 6, after the user has seen every PR and confirmed.

Wait for the completion notifications. Do not poll, do not schedule wake-ups. A reviewer whose finding needs clarification is continued with `SendMessage`, not re-spawned.

## Step 4 - Parse results and clean up worktrees

1. Parse each `PR_REVIEW_RESULT` / `PR_VERIFY_RESULT` block and its JSON payload. A subagent that died or returned no block is reported as failed for that PR - never fabricate a verdict for it, and leave nothing half-posted unmentioned. It is excluded from Step 5/6 (nothing to confirm, nothing to post).
2. Remove the worktrees: `git worktree remove --force "$dir"` per PR, then `git worktree prune`. Remove the scratchpad clones too. Nothing in Step 5/6 needs worktree access, so clean up now rather than holding them through the (interactive, possibly slow) confirmation step.

## Step 5 - Report and get verdict confirmation

For every parsed PR, print the per-PR report block from the Terminal Output section above: link/title, computed verdict, the full blockers list, and the **complete** nice-to-have list (not just a count - the whole point of surfacing them is that a real issue sometimes got classified MEDIUM/LOW, and the user can only catch that by reading it).

Then ask the user to confirm or override, one `AskUserQuestion` question per PR: header `PR #{n}`, question naming the PR and its computed verdict, two options - the computed verdict first, labeled `(Recommended)`, and the opposite verdict second. Batch up to 4 questions in a single `AskUserQuestion` call (its hard limit); for more than 4 PRs in this run, issue additional calls, one batch after another. Record each PR's `final_verdict` from the answer - it may equal or differ from `computed_verdict`.

Own-PR note: still ask (the confirmed verdict still drives the summary body's verdict line), but the GitHub `event` sent in Step 6 is forced to `COMMENT` regardless of the answer, since GitHub rejects self-approval/self-request-changes.

## Step 6 - Render and post confirmed reviews

For each PR, using its stored payload and `final_verdict`:

1. Render the summary body from `references/comment-templates.md` template 3 (review) or template 5 (verify) - blockers section included whenever `blockers` is non-empty, *even when `final_verdict` is approve*, and the override note added whenever `final_verdict != computed_verdict`.
2. Map to the GitHub `event`: `approve` → `APPROVE`, `request-changes` → `REQUEST_CHANGES`, own PR → `COMMENT` (see above).
3. Post the one review call per PR (inline blocker comments + summary body + event) per the "Posting mechanics" section of `comment-templates.md`. On a 422 anchor failure, drop that comment into the summary's Context findings section and retry once - never retry the identical payload.
4. Verify mode only: after the review call succeeds, resolve every thread in `threads_to_resolve` (ours, classified ✅ in Step 2 of the verify template).
5. Print the "posted" completion line for that PR.

Print the final `Done: {approved} approved, {changes_requested} changes requested` line once every PR in the run has been posted (or reported failed in Step 4).

## Verdict Policy (single source, mirrored in the prompts)

| Findings | Computed verdict | User can override to | GitHub event |
|---|---|---|---|
| Any confirmed CRITICAL / HIGH | request changes | approve (Step 5) | `REQUEST_CHANGES`, or `APPROVE` if overridden |
| Only MEDIUM / LOW (nice-to-haves) | approve | request changes (Step 5) | `APPROVE`, or `REQUEST_CHANGES` if overridden |
| Reviewer is the PR author | unchanged by the above, confirmed the same way | - | `COMMENT` always (GitHub rejects self-approval) |

Nice-to-haves never block *by themselves* - the computed verdict never turns to request-changes for MEDIUM/LOW alone. But they are never silently dropped either: the full list reaches the user in Step 5, precisely so a nice-to-have that is actually important can get its own override. Nitpicks - style pedantry, linter-territory, personal taste - are at most nice-to-haves.

## Rules

- Always print the terminal block on start, the per-PR computed-verdict lines, the full report in Step 5, and the posted-completion lines in Step 6.
- Reviewer subagents compute and return; they never call the GitHub posting API or a thread-resolve mutation. Only the orchestrator posts, and only after Step 5 confirmation.
- Comments come from `references/comment-templates.md` only, hidden markers included - `--verify` depends on them.
- One reviewer subagent per PR, no nested subagents, `/bdk:cr --inline` inside. State this in every dispatch prompt even though the template already carries it.
- Every review and every verification ends in exactly one of: approve, request changes - as confirmed or overridden by the user in Step 5, never assumed.
- Worktrees are always removed, including on failure paths.

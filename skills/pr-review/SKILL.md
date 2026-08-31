---
name: pr-review
description: Review GitHub PRs from URLs - templated inline comments, summary, and approve/request-changes verdict posted via gh. Stack-aware; one subagent per PR runs /bdk:cr --inline. --verify checks previous review comments were implemented.
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
- **Reviews are outward-facing.** Everything posted goes to GitHub where the PR author and team see it - which is exactly what the user asked for, so post without re-asking, but post *only* through the templates in `references/comment-templates.md`. No ad-hoc comment shapes.
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
[pr-review] PR #{n}: ✓ {verdict} ({c}C/{h}H/{m}M/{l}L, {k} inline comments)
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

Fill template A (review) or B (verify) per PR - every placeholder, including `{plugin_root}` = `${CLAUDE_PLUGIN_ROOT}` - and launch all subagents as `general-purpose` in a **single message with multiple Agent calls**. The template's no-subagent rule is the load-bearing line: each reviewer runs the whole `/bdk:cr --inline` engine sequentially in its own session, because a subagent cannot spawn agents and must not try.

Wait for the completion notifications. Do not poll, do not schedule wake-ups. A reviewer whose finding needs clarification is continued with `SendMessage`, not re-spawned.

## Step 4 - Aggregate and clean up

1. Parse each `PR_REVIEW_RESULT` / `PR_VERIFY_RESULT` block. A subagent that died or returned no block is reported as failed for that PR - never fabricate a verdict for it, and leave nothing half-posted unmentioned.
2. Remove the worktrees: `git worktree remove --force "$dir"` per PR, then `git worktree prune`. Remove the scratchpad clones too.
3. Print the completion lines and give the user, per PR: link, verdict, blocker count, nice-to-have count, and anything from `notes` (dropped anchors, degraded passes, draft status, "own PR - verdict posted as comment").

## Verdict Policy (single source, mirrored in the prompts)

| Findings | Verdict | GitHub event |
|---|---|---|
| Any confirmed CRITICAL / HIGH | request changes | `REQUEST_CHANGES` |
| Only MEDIUM / LOW (nice-to-haves) | approve | `APPROVE` |
| Reviewer is the PR author | verdict unchanged, stated in the summary body | `COMMENT` (GitHub rejects self-approval) |

Nice-to-haves never block. Nitpicks - style pedantry, linter-territory, personal taste - are at most nice-to-haves and are the difference between a review people read and one they mute.

## Rules

- Always print the terminal block on start and the per-PR completion lines.
- Comments come from `references/comment-templates.md` only, hidden markers included - `--verify` depends on them.
- One reviewer subagent per PR, no nested subagents, `/bdk:cr --inline` inside. State this in every dispatch prompt even though the template already carries it.
- Every review and every verification ends in exactly one of: approve, request changes.
- Worktrees are always removed, including on failure paths.

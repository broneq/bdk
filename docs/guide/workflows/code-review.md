# Code review

Every Change ends with a review. `/bdk:cr` reviews the Change on the current branch in rounds: role agents review its groups, a runner runs the full gate, and blocking findings are fixed and reviewed again until none is left. `/bdk:pr-review` reviews pull requests on GitHub and posts the result there.

## Where the review comes from

A Change reaches the review stage after `/bdk:execute`, and `/bdk:run` starts `/bdk:cr` there. You can also run `/bdk:cr` yourself:

- **On a branch with an active Change**, it reviews that Change.
- **On a branch without one**, it opens a review Change of the branch first, with `bdk change new "<intent>" --inferred --kind review`. The intent comes from the branch name and its commit subjects; `--base <ref>` sets the base for a stacked branch. A review Change has no design or plan of its own: the review stage is its first stage.

## Choosing the range

| Command                | Range reviewed                                                    |
| ---------------------- | ----------------------------------------------------------------- |
| `/bdk:cr`              | the delta since the last merged review, or the whole Change first |
| `/bdk:cr --full`       | the whole Change from its merge base                              |
| `/bdk:cr --base <ref>` | from `git merge-base HEAD <ref>`, for a stacked branch            |
| `/bdk:cr --inline`     | the same range, with no agents (see below)                        |

Any other text is the focus of the run, which every reviewer receives. `bdk review plan` resolves the range and reports the files changed outside the plan's `Files:` as `dirty`; when nothing changed since the last review it opens no round.

## A round

One round is one `review-fix` ticket:

1. **Plan.** `bdk review plan` splits the range into groups: one per plan part, one for files no part names, and one `integration` group over the whole range.
2. **Dispatch.** One package per group goes to a `reviewer` agent, the `integration` group to an Opus `integration-reviewer`, and one more package to a `runner` that runs the full gate and the diff coverage on the whole Change. Each agent reads the rules of its role and files with `bdk rules show --ticket` and writes its findings to the ledger.
3. **Triage.** The orchestrator gives every finding of the round one level: `blocker`, `should-fix`, `nice-to-have` or `not-a-problem`. A blocker must name one of the blocking categories of `policy.verifier`; a finding that repeats another is `not-a-problem`.
4. **Merge.** The round's merged report is stored under `<ticket>@merge`, with every entry per level, the gate's verdicts and the coverage.
5. **Close.** Without a blocking entry the ticket closes `ok` and `bdk done review` passes. With one it closes `fail`, and the kernel decides the next round: a retry, a narrower scope, an escalation to a stronger model, or parking the Change for a human.

A round that starts with blocking entries fixes them first: an `implementer` package embeds every blocking entry, its fix is committed under the ticket, and each entry it fixed is resolved. The round then reviews the delta, and the runner runs the full gate again.

`/bdk:cr` never edits a file itself: it declares `disallowed-tools: Edit Write NotebookEdit`, and every fix goes through an implementer package.

## `--inline`

`--inline` runs the same packages in the session, one after another, with no agent. It reviews and triages, but fixes nothing: with blocking entries it closes the round `fail` and names them, and `/bdk:cr` without `--inline` fixes them.

## Reviewing GitHub pull requests

```
/bdk:pr-review <pr-url> [<pr-url> ...] [--verify] [focus]
```

Each PR is reviewed in a detached worktree of its head by the `pr-reviewer` role, one after another. The review keeps no state: no ticket, no ledger entry, no file under `.bdk/`. When the range adds or changes a Change directory under `.bdk/changes/`, the reviewer checks the PR against that Change's contract too.

The skill shows each PR's computed verdict with every finding before anything reaches GitHub:

```
── PR #{n}: {title} ── computed verdict: request-changes
  {path}:{line} [{severity} · {category}] {problem}
  ...
```

!!! warning
Nothing is posted to GitHub until you confirm. You confirm or override each PR's verdict, and only then does a single review call per PR post the inline comments, the summary and the event.

Verdict policy: any finding the reviewer marks blocking computes to request-changes; otherwise approve. Non-blocking findings never turn the verdict, but the whole list reaches you so one that matters can get an override. On your own PR the GitHub event is `COMMENT`, since GitHub rejects self-review.

### Stacked PRs

When a PR's base is not the default branch and an open PR has that base as its head, `/bdk:pr-review` reviews only **this PR's own diff against its parent branch**. One URL reviews one PR, so list every stack entry you want reviewed.

### `--verify`

`--verify` checks whether the author fixed what the previous review asked for. It reads the previous review's threads (the templates carry hidden markers for this), the reviewer classifies each as fixed, not fixed or outdated, and after posting the skill resolves the threads that were fixed.

## What you get

| Output        | Where                                                                                          |
| ------------- | ---------------------------------------------------------------------------------------------- |
| Review report | the ledger of the Change: findings by level, and the merged report under `<ticket>@merge`      |
| PR review     | inline comments plus one templated summary on GitHub, with an approve or request-changes event |

## Next step

`/bdk:close` once `gate:review` is ready. Then keep the rules honest: [Rules hygiene](rules-hygiene.md).

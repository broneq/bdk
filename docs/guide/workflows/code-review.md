# Code review

Every Change ends with a review. `/bdk:cr` reviews the Change on the current branch in rounds: role agents review its groups, a runner runs the full gate, and blocking findings are fixed and reviewed again until none is left. It ends with a report in which you decide what happens to every entry left open. `/bdk:pr-review` reviews pull requests on GitHub, lets you decide each finding, and posts the result there.

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
| `/bdk:cr --report`     | no range: the report only, to decide or change the dispositions   |

Any other text is the focus of the run, which every reviewer receives. `bdk review plan` resolves the range and reports the files changed outside the plan's `Files:` as `dirty`; when nothing changed since the last review it opens no round.

## A round

One round is one `review-fix` ticket:

1. **Plan.** `bdk review plan` splits the range into groups: one per plan part, one for files no part names, and one `integration` group over the whole range.
2. **Dispatch.** One package per group goes to a `reviewer` agent, the `integration` group to an Opus `integration-reviewer`, and one more package to a `runner` that runs the full gate and the diff coverage on the whole Change. Each agent reads the rules of its role and files with `bdk rules show --ticket` and writes its findings to the ledger.
3. **Triage.** The orchestrator gives every finding of the round, and every other live entry of the Change without a level (such as an observation the verifier wrote during execute), one level: `blocker`, `should-fix`, `nice-to-have` or `not-a-problem`. A blocker must name one of the blocking categories of `policy.verifier`; a finding that repeats another is `not-a-problem`.
4. **Merge.** The round's merged report is stored under `<ticket>@merge`, with every entry per level, the gate's verdicts and the coverage.
5. **Close.** Without a blocking entry the ticket closes `ok` and `bdk done review` passes. With one it closes `fail`, and the kernel decides the next round: a retry, a narrower scope, an escalation to a stronger model, or parking the Change for a human.

A round that starts with blocking entries fixes them first: an `implementer` package embeds every blocking entry, its fix is committed under the ticket, and each entry it fixed is resolved. The round then reviews the delta, and the runner runs the full gate again.

`/bdk:cr` never edits a file itself: it declares `disallowed-tools: Edit Write NotebookEdit`, and every fix goes through an implementer package.

## The report

After `bdk done review`, `/bdk:cr` renders the human report with `bdk review render`: one self-contained HTML file under `.bdk/.machine/review/`, or Markdown with `--format md`. It shows:

- **Parts and areas:** the plan parts against the changed modules, with how much each part changed there.
- **Change map:** one card per configured risk area the range touches (`review.risks` with `paths`), with the integration reviewer's one-sentence summary of what changed there and why, then the files outside the plan. Each file lists the tasks and commits that changed it and the entries that name it.
- **Gate:** the verdicts of `tests-full` and `lint-full` and the coverage against its minimum.
- **Decisions:** every open `should-fix`, `nice-to-have` and untriaged entry, with its problem, why it matters and the suggested fix. Blockers are fixed by the rounds, so they never reach this list.
- **Settled** and **Context:** the resolved entries with their reason, and the live decisions, assumptions and risks.

You give each entry in Decisions one disposition:

| Disposition | What happens                                                                                                             |
| ----------- | ------------------------------------------------------------------------------------------------------------------------ |
| `fix`       | `/bdk:cr` starts a new round that fixes it first, reviews the delta and shows the report again.                          |
| `defer`     | It stays open and is listed in the PR summary as deferred.                                                               |
| `reject`    | It is resolved with your reason.                                                                                         |
| `track`     | It is filed in your tracker first (`tracker` setting: GitHub issues or your own instruction), and the issue is recorded. |

With Lavish on (`features.lavish`), the report opens in Lavish and you pick the dispositions on the page. Without it, `/bdk:cr` prints the Markdown summary and asks in the terminal, `defer` first. Each answer is recorded with `bdk log decide <id> <disposition>`. `/bdk:close` refuses while an entry has no disposition or a `fix` is not made (`policy/undecided-entries`); `/bdk:cr --report` reopens the report without a round.

Inside `/bdk:run` nobody answers: every entry without a disposition is deferred with `review: true`, the run goes on, and its finish names the report path and `/bdk:cr --report`.

## `--inline`

`--inline` runs the same packages in the session, one after another, with no agent. It reviews and triages, but fixes nothing: with blocking entries it closes the round `fail` and names them, and `/bdk:cr` without `--inline` fixes them.

## Reviewing GitHub pull requests

```
/bdk:pr-review <pr-url> [<pr-url> ...] [--verify] [--quick] [focus]
```

Each PR is reviewed in a detached worktree of its head by the `pr-reviewer` role, one after another. The review keeps no state: no ticket, no ledger entry, no file under `.bdk/`. When the range adds or changes a Change directory under `.bdk/changes/`, the reviewer checks the PR against that Change's contract too.

Before anything reaches GitHub, the skill renders a decision page with `bdk review render --pr - --out <file>` and opens it in Lavish. Per finding you choose:

| Choice         | What is posted                                                                |
| -------------- | ----------------------------------------------------------------------------- |
| `blocker`      | an inline comment; the PR's verdict is request-changes                        |
| `nice-to-have` | a bullet of the summary's nice-to-have section                                |
| `tracker`      | an issue filed in your tracker first, listed in the summary's tracked section |
| `drop`         | nothing                                                                       |

Each finding starts at the reviewer's choice: `blocker` when it marked it blocking, `nice-to-have` otherwise. The page shows the verdict your choices give: request-changes while any finding is a blocker, approve otherwise.

With `--quick`, or when Lavish is off or fails, the skill prints each PR's computed verdict with every finding and asks you to confirm or override the verdict in the terminal instead:

```
── PR #{n}: {title} ── computed verdict: request-changes
  {path}:{line} [{severity} · {category}] {problem}
  ...
```

!!! warning

    Nothing is posted to GitHub until you decide. Only then does a single review call per
    PR post the inline comments, the summary and the event.

On your own PR the GitHub event is `COMMENT`, since GitHub rejects self-review.

### Stacked PRs

When a PR's base is not the default branch and an open PR has that base as its head, `/bdk:pr-review` reviews only **this PR's own diff against its parent branch**. One URL reviews one PR, so list every stack entry you want reviewed.

### `--verify`

`--verify` checks whether the author fixed what the previous review asked for. It reads the previous review's threads (the templates carry hidden markers for this), the reviewer classifies each as fixed, not fixed or outdated, and after posting the skill resolves the threads that were fixed.

## What you get

| Output        | Where                                                                                          |
| ------------- | ---------------------------------------------------------------------------------------------- |
| Review report | the ledger of the Change: findings by level, and the merged report under `<ticket>@merge`      |
| Human report  | `.bdk/.machine/review/<change-id>.html`, with your disposition of every open entry             |
| PR review     | inline comments plus one templated summary on GitHub, with an approve or request-changes event |

## Next step

`/bdk:close` once `gate:review` is ready and every entry has a disposition. Then keep the rules honest: [Rules hygiene](rules-hygiene.md).

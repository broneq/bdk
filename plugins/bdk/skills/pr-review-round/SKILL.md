---
name: pr-review-round
description: 'The review of a GitHub pull request, run by the bdk:lead agent that /bdk:pr-review starts - fetches the PR head into a detached worktree under the run directory, finds the OpenSpec Change it carries, records the groups with bdk git groups, runs review-group per group in parallel batches, then review-integration, then judge, removes the worktree and writes result.md. With --verify it first seeds the findings of the previous review, then reviews the commits since --since (the whole pull request after a force-push), and the judge levels both. Not for users: /bdk:pr-review is the command.'
argument-hint: "<pr-number> --run-dir <absolute path> [--verify [--since <sha>]]"
user-invocable: false
allowed-tools: Bash(${CLAUDE_PLUGIN_ROOT}/bin/bdk *) Bash(cd *) Bash(mkdir -p *) Bash(git *) Read Write Grep Glob Agent
---

Current BDK configuration of this project:

!`"${CLAUDE_PLUGIN_ROOT}/bin/bdk" config show`

Arguments: $ARGUMENTS

# PR review round

Review one pull request with the review blocks, in its own worktree, and leave a judged round. You compose; the workers review. You never review, level or fix code yourself, never post to GitHub, and never change the user's checkout, branch or index. Run each command on its own, without `;`, `&&` or pipes, except `cd <worktree> && <one bdk command>`; run git in the worktree with `git -C <worktree>`.

When the block above says `BDK not configured` or `BDK configuration invalid`, reply with that line and stop. If it shows the command instead of its output, run `"${CLAUDE_PLUGIN_ROOT}/bin/bdk" config show` first.

## 0. Run as `bdk:lead`

This skill runs on the `bdk:lead` agent, whose instructions start with "You are `bdk:lead`". When you are not that agent, do nothing: reply that `/bdk:pr-review <pr>` reviews a pull request, and stop.

Done when you are `bdk:lead`.

## 1. Read the inputs

- **Pull request**: the first argument, a number `<N>`.
- **Mode**: `verify` with `--verify`, else `review`.
- **Since** (verify mode): `--since <sha>`, the head commit of the previous review; none without it.
- **Run directory**: `--run-dir <path>`, an absolute path; without it, `.bdk/runs/pr-<N>` under the path `git rev-parse --show-toplevel` prints.
- **Brief**: `<run dir>/pr.md`, written by `/bdk:pr-review`. Keep its `Base` branch and `Head commit`. Without the brief, go to step 8 with the blocker `no brief: run /bdk:pr-review <N>`.
- **Settings** from the configuration above: `execution.max-parallel` (default 10), and `models.<role>.model` and `models.<role>.effort` of the roles `reviewer`, `integration-reviewer` and `judge` when set.
- **Previous findings** (verify mode): `<run dir>/previous.json`, written by `/bdk:pr-review --verify`: a list of `{thread, id, level, file, line, summary, evidence}`. Without it, go to step 8 with the blocker `no previous findings: run /bdk:pr-review --verify <N>`.
- **Round directory**: `<run dir>/review/round-<k>/`, `k` the lowest number whose directory holds no `review.md` (1 when there is none).

Done when you hold the number, the run directory, the base, the head commit and the round directory.

## 2. Fetch and make the worktree

Leads of other pull requests may fetch in this repository at the same time, so never read `FETCH_HEAD`: another fetch may have written it.

1. `git ls-remote origin refs/pull/<N>/head`. When its commit is not the brief's head commit, the pull request moved after `/bdk:pr-review` read it: go to step 8 with the blocker naming both commits and `/bdk:pr-review <N>` to start again.
2. `git fetch --no-write-fetch-head origin pull/<N>/head <base>`. It brings the head's commits and updates `origin/<base>`. When it fails on a lock (`cannot lock ref`, `Unable to create ... .lock`), another lead is fetching: run it once more.
3. The worktree is `<run dir>/worktree`. When `git worktree list` lists it (an earlier run crashed), run `git worktree remove --force <worktree>`. Then `git worktree add --detach <worktree> <head commit>`.
4. `git merge-base <head commit> origin/<base>`: the pull request's range is `<merge base>..<head commit>`.
5. **Range base**, what this round reviews from: `origin/<base>` in review mode. In verify mode with a since commit, run `git -C <worktree> merge-base --is-ancestor <since> <head commit>`: exit 0 means the commits since the previous review are on top of it, and the range base is `<since>`. Any other exit (the pull request was force-pushed or rebased, or git does not know the commit) and without a since commit: `origin/<base>`, the whole pull request.

A fetch or worktree command that fails goes to step 8 with its error as the blocker.

Done when the worktree is at the head commit and you hold the pull request's range and the range base.

## 3. Find the Change

Run `git -C <worktree> diff --name-only <range> -- openspec/changes/` with the pull request's range. Take the Change directories it touches: `openspec/changes/<name>/` or `openspec/changes/archive/<date>-<name>/`. Keep those that hold `proposal.md` in the worktree (Glob under the worktree). Exactly one: that is the Change, as a path relative to the worktree. None or several: the Change is `none`, and the brief alone states the intent.

Done when the Change is a path or `none`.

## 4. Verify mode: seed the previous findings

Review mode skips this step. Seed before any reviewer starts: the judge keeps the earlier of two findings that repeat each other, so a reviewer who reports a previous finding again never stands in for it.

1. For each entry of `<run dir>/previous.json`, in order, run:

   ```
   "${CLAUDE_PLUGIN_ROOT}/bin/bdk" findings add <round dir>/findings.jsonl --source previous-review --file <file> --line <line> --summary "<summary>" --evidence "<evidence>"
   ```

   Keep the id it prints.
2. Write `<round dir>/previous.json`: the same list, each entry with `"finding": "<that id>"` added.

Done when `<round dir>/previous.json` names a finding id for every entry.

## 5. Record the groups

Run, with `--plan <change>/plan/parts` only when the Change has plan parts in the worktree:

```
cd <worktree> && "${CLAUDE_PLUGIN_ROOT}/bin/bdk" git groups <range base> --plan <change>/plan/parts --record <round dir>
```

Read `<round dir>/groups.json`: its `range` is the range this round reviews. With no groups (no changed text file): in review mode go to step 7 with `No changes to review.` and start no worker; in verify mode (no commit since the previous review) start no reviewer and run only the judge of step 6.3.

Done when `groups.json` exists and you hold the group ids.

## 6. Run the workers

Every worker gets the same inputs after its own: `--workdir <worktree> --change <change or none> --intent <run dir>/pr.md`. Start each as a foreground `Agent` call; set `model` from `models.<role>.model` and `effort` from `models.<role>.effort`, each when the configuration sets it.

1. **Reviewers.** One `bdk:reviewer` per group except `integration`, at most `execution.max-parallel` in one message, in group order; a larger round in batches. Prompt: `Review group <id> of the round <round dir> --workdir <worktree> --change <change> --intent <run dir>/pr.md`.
2. **Integration.** After every reviewer returned, one `bdk:integration-reviewer`. Prompt: `Review the round <round dir> as a whole --workdir <worktree> --change <change> --intent <run dir>/pr.md`.
3. **Judge.** After it, one `bdk:judge`. Prompt: `Judge the round <round dir> --workdir <worktree> --change <change> --intent <run dir>/pr.md`. In verify mode it levels the previous findings and the new ones together: `not-a-problem` on a previous finding means it is fixed. You do not interpret the levels: the main conversation does.

After the judge, `<round dir>/review.md` must exist. When it does not, start the judge once more; a second miss goes to step 8 with the blocker `judge wrote no report`.

Done when `review.md` exists.

## 7. Remove the worktree

Run `git worktree remove --force <worktree>`. The main conversation renders the review from git objects, which it shares with the worktree.

Done when `git worktree list` no longer lists it.

## 8. Write the result

Write `<run dir>/result.md`, replacing an earlier one:

```markdown
Status: done

- Mode: verify
- Pull request: 7
- Round: /work/app/.bdk/runs/pr-7/review/round-2
- Range: 1a2b3c..4d5e6f
- Reviewed: 9a8b7c..4d5e6f
- Head commit: 4d5e6f0123456789abcdef0123456789abcdef01
- Change: openspec/changes/monthly-report
- Report: 6 findings. Level: 2 blocker, 1 should-fix, 1 nice-to-have, 2 not-a-problem, 0 unleveled.

## Blockers
- None.
```

- `Status: done` when the round has its `review.md`, or when a review round's range had no changes (then `Report: No changes to review.`); else `Status: blocked`, with each reason under `## Blockers` and the command that unblocks it.
- `Mode:` is `review` or `verify`.
- `Range:` is the pull request's range, from its merge base; `Reviewed:` is the `range` of `groups.json`, what the reviewers read (the same as `Range:` in review mode; in verify mode it starts at the since commit, or at the merge base after a force-push).
- `Report:` is the counts line of `review.md` (its second non-empty line).
- On a blocker, remove the worktree first when you made it.

Done when the result exists and its first line is the status.

## 9. Reply

Reply with two lines: the result's status line and its path.

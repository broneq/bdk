---
name: pr-review-round
description: 'The review of a GitHub pull request, run by the bdk:lead agent that /bdk:pr-review starts - fetches the PR head into a detached worktree under the run directory, finds the OpenSpec Change it carries, records the groups with bdk git groups, runs review-group per group in parallel batches, then review-integration, then judge, removes the worktree and writes result.md. With --verify it re-checks the findings of the previous review with the judge instead. Not for users: /bdk:pr-review is the command.'
argument-hint: "<pr-number> --run-dir <absolute path> [--verify]"
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
- **Run directory**: `--run-dir <path>`, an absolute path; without it, `.bdk/runs/pr-<N>` under the path `git rev-parse --show-toplevel` prints.
- **Brief**: `<run dir>/pr.md`, written by `/bdk:pr-review`. Keep its `Base` branch and `Head commit`. Without the brief, go to step 7 with the blocker `no brief: run /bdk:pr-review <N>`.
- **Settings** from the configuration above: `execution.max-parallel` (default 10), and `models.reviewer`, `models.integration-reviewer` and `models.judge` when set.
- **Previous findings** (verify mode): `<run dir>/previous.json`, written by `/bdk:pr-review --verify`: a list of `{thread, id, level, file, line, summary, evidence}`. Without it, go to step 7 with the blocker `no previous findings: run /bdk:pr-review --verify <N>`.
- **Round directory**: `<run dir>/review/round-<k>/`, `k` the lowest number whose directory holds no `report.md` (1 when there is none).

Done when you hold the number, the run directory, the base, the head commit and the round directory.

## 2. Fetch and make the worktree

Leads of other pull requests may fetch in this repository at the same time, so never read `FETCH_HEAD`: another fetch may have written it.

1. `git ls-remote origin refs/pull/<N>/head`. When its commit is not the brief's head commit, the pull request moved after `/bdk:pr-review` read it: go to step 7 with the blocker naming both commits and `/bdk:pr-review <N>` to start again.
2. `git fetch --no-write-fetch-head origin pull/<N>/head <base>`. It brings the head's commits and updates `origin/<base>`. When it fails on a lock (`cannot lock ref`, `Unable to create ... .lock`), another lead is fetching: run it once more.
3. The worktree is `<run dir>/worktree`. When `git worktree list` lists it (an earlier run crashed), run `git worktree remove --force <worktree>`. Then `git worktree add --detach <worktree> <head commit>`.
4. `git merge-base <head commit> origin/<base>`: the range is `<merge base>..<head commit>`.

A fetch or worktree command that fails goes to step 7 with its error as the blocker.

Done when the worktree is at the head commit and you hold the range.

## 3. Find the Change

Run `git -C <worktree> diff --name-only <range> -- openspec/changes/`. Take the Change directories it touches: `openspec/changes/<name>/` or `openspec/changes/archive/<date>-<name>/`. Keep those that hold `proposal.md` in the worktree (Glob under the worktree). Exactly one: that is the Change, as a path relative to the worktree. None or several: the Change is `none`, and the brief alone states the intent.

Done when the Change is a path or `none`.

In verify mode, go to step 5b after this step.

## 4. Record the groups

Run, with `--plan <change>/plan/parts` only when the Change has plan parts in the worktree:

```
cd <worktree> && "${CLAUDE_PLUGIN_ROOT}/bin/bdk" git groups origin/<base> --plan <change>/plan/parts --record <round dir>
```

Read `<round dir>/groups.json`. With no groups (no changed text file), go to step 6 with `No changes to review.`; start no worker.

Done when `groups.json` exists and you hold the group ids.

## 5. Run the workers

Every worker gets the same inputs after its own: `--workdir <worktree> --change <change or none> --intent <run dir>/pr.md`. Start each as a foreground `Agent` call; set `model` from `models.<role>` when the configuration sets it.

1. **Reviewers.** One `bdk:reviewer` per group except `integration`, at most `execution.max-parallel` in one message, in group order; a larger round in batches. Prompt: `Review group <id> of the round <round dir> --workdir <worktree> --change <change> --intent <run dir>/pr.md`.
2. **Integration.** After every reviewer returned, one `bdk:integration-reviewer`. Prompt: `Review the round <round dir> as a whole --workdir <worktree> --change <change> --intent <run dir>/pr.md`.
3. **Judge.** After it, one `bdk:judge`. Prompt: `Judge the round <round dir> --workdir <worktree> --change <change> --intent <run dir>/pr.md`.

After the judge, `<round dir>/report.md` must exist. When it does not, start the judge once more; a second miss goes to step 7 with the blocker `judge wrote no report`.

Done when `report.md` exists.

## 5b. Verify mode: re-check the previous findings

No groups and no reviewers: the judge decides, at the current head, whether each previous finding still fails.

1. For each entry of `<run dir>/previous.json`, in order, run:

   ```
   "${CLAUDE_PLUGIN_ROOT}/bin/bdk" findings add <round dir>/findings.jsonl --source previous-review --file <file> --line <line> --summary "<summary>" --evidence "<evidence>"
   ```

   Keep the id it prints.
2. Write `<round dir>/previous.json`: the same list, each entry with `"finding": "<that id>"` added.
3. Start one `bdk:judge` as in step 5.3 (the same prompt and inputs), and check `report.md` the same way.

`not-a-problem` means the finding is fixed; any other level means it is left. You do not interpret the levels: the main conversation does.

Done when `report.md` exists and `<round dir>/previous.json` names a finding id for every entry.

## 6. Remove the worktree

Run `git worktree remove --force <worktree>`. The main conversation renders the review from git objects, which it shares with the worktree.

Done when `git worktree list` no longer lists it.

## 7. Write the result

Write `<run dir>/result.md`, replacing an earlier one:

```markdown
Status: done

- Mode: review
- Pull request: 7
- Round: /work/app/.bdk/runs/pr-7/review/round-1
- Range: 1a2b3c..4d5e6f
- Head commit: 4d5e6f0123456789abcdef0123456789abcdef01
- Change: openspec/changes/monthly-report
- Report: 6 findings. Level: 2 blocker, 1 should-fix, 1 nice-to-have, 2 not-a-problem, 0 unleveled.

## Blockers
- None.
```

- `Status: done` when the round has its `report.md`, or when the range had no changes (then `Report: No changes to review.`); else `Status: blocked`, with each reason under `## Blockers` and the command that unblocks it.
- `Mode:` is `review` or `verify`.
- `Report:` is the counts line of `report.md` (its second non-empty line).
- On a blocker, remove the worktree first when you made it.

Done when the result exists and its first line is the status.

## 8. Reply

Reply with two lines: the result's status line and its path.

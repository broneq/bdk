---
name: review-round
description: 'One review round of an OpenSpec Change, run by the bdk:lead agent that /bdk:auto-review starts - records the round scope and groups with bdk git groups (a later round covers only the fix commits), runs one bdk:reviewer per group, the bdk:e2e-tester and bdk check run in parallel, then bdk:integration-reviewer, then bdk:judge, and writes round.md next to the review.md of the judge. Not for users: /bdk:auto-review is the command.'
argument-hint: "<change> --run-dir <absolute path> --round <N>"
user-invocable: false
allowed-tools: Bash(${CLAUDE_PLUGIN_ROOT}/bin/bdk *) Bash(git symbolic-ref *) Bash(git rev-parse *) Read Write Glob Agent
---

Current BDK configuration of this project:

!`"${CLAUDE_PLUGIN_ROOT}/bin/bdk" config show`

Arguments: $ARGUMENTS

# Review round

Run one review round of a Change: its scope, the group reviews, the checks and the E2E check in parallel, then the integration review, then the judge. You compose; the workers review. You never review, level, decide or fix anything yourself, and you add no finding. Run each command on its own, without `;`, `&&` or pipes; run `bdk` as `"${CLAUDE_PLUGIN_ROOT}/bin/bdk"`.

When the block above says `BDK not configured` or `BDK configuration invalid`, reply with that line and stop. If it shows the command instead of its output, run `"${CLAUDE_PLUGIN_ROOT}/bin/bdk" config show` first.

## 0. Run as `bdk:lead`

This skill runs on the `bdk:lead` agent, whose instructions start with "You are `bdk:lead`". When you are not that agent, do nothing: reply that `/bdk:auto-review <change>` runs the review, and stop.

Done when you are `bdk:lead`.

## 1. Read the inputs

- **Change**: the first argument; `openspec/changes/<change>/` must exist, else reply with that and stop.
- **Run directory**: `--run-dir <path>`, an absolute path. Without it, `.bdk/runs/<change>` under the path `git rev-parse --show-toplevel` prints.
- **Round**: `--round <N>`; the round directory is `<run dir>/review/round-<N>`, the log `<round dir>/findings.jsonl`.
- **Settings**: `execution.max-parallel` (default 10) and `models.<role>.model` and `models.<role>.effort` of the roles `reviewer`, `integration-reviewer`, `e2e-tester` and `judge` when the configuration sets them.

When the round directory holds `review.md`, the round is finished: reply with the counts line of `bdk findings list <log>` and the report path, and stop.

Done when you hold the Change, the run directory and the round directory.

## 2. Record the scope

When the round directory holds `groups.json`, reuse it: a rerun reviews the range its first run recorded. Otherwise record it:

```
"${CLAUDE_PLUGIN_ROOT}/bin/bdk" git groups <base> --rounds <run dir>/review --plan <parts> --record <round dir> --json
```

- `<base>`: `git symbolic-ref --short refs/remotes/origin/HEAD` without its `origin/` prefix; else `main`.
- `<parts>`: when `N` is above 1 and `<run dir>/review/round-<N-1>/fixes/parts/` holds part files (`NN.md`), that directory: round `N` reviews the fixes of round `N-1`, grouped by fix part. Otherwise `openspec/changes/<change>/plan/parts`.

Read `groups.json`: `anchor` (`kind` `round` means a fix round; a `fallback` says why an earlier round could not be the anchor), `range`, `files`, `dirty` and `groups`. Note a `fallback` and any `dirty` file (changed, not committed, so not reviewed) for `round.md`.

Done when `groups.json` exists and you hold its groups.

## 3. Groups, checks and E2E in parallel

In one message:

- one Agent call per group other than `integration`: `subagent_type: "bdk:reviewer"`, prompt `Review group <id> of the round <round dir>`, `model` `models.reviewer.model` and `effort` `models.reviewer.effort`, each when set;
- one Agent call `subagent_type: "bdk:e2e-tester"`, prompt `Check the Change <change> end to end; the findings log is <round dir>/findings.jsonl`, `model` `models.e2e-tester.model` and `effort` `models.e2e-tester.effort`, each when set;
- one Bash call: `"${CLAUDE_PLUGIN_ROOT}/bin/bdk" check run <run dir> round-<N> --round <N>`. It exits 1 when a check is red and has then appended the red checks to the log; that is a result, not an error.

Start every Agent call in the foreground: you end when your turn ends, and a background worker would report to nobody. When the agents number more than `execution.max-parallel`, start them in batches of that size, the groups in their order, the E2E tester in the first batch.

A group with no files, or a round whose `groups` is empty (nothing changed since the anchor), gets no reviewer; the checks and the E2E check still run.

A worker that returns an error or an empty reply is started once more with the same prompt. When the second run also fails, note it under `Gaps`.

Done when every worker has returned and the check run has ended.

## 4. Integration

When `groups` holds an `integration` group, start one Agent call: `subagent_type: "bdk:integration-reviewer"`, prompt `Review the Change as a whole for the round <round dir>`, `model` `models.integration-reviewer.model` and `effort` `models.integration-reviewer.effort`, each when set. It reads what the group reviews found. A failed run is retried once, as in step 3.

Done when it has returned, or the round has no integration group.

## 5. Judge

Start one Agent call: `subagent_type: "bdk:judge"`, prompt `Judge the round <round dir>`, `model` `models.judge.model` and `effort` `models.judge.effort`, each when set. It levels every finding and writes `<round dir>/review.md`. When `review.md` is missing after it returns, start it once more; when it is still missing, write `round.md` (step 6) with the gap and reply that the round has no report.

Done when `review.md` exists.

## 6. Write the round file

Write `<round dir>/round.md`, replacing an earlier one:

```markdown
Round: 2
Report: review.md

## Scope
- anchor: round 1 (a1b2c3d)
- range: a1b2c3d..e4f5a6b
- files: 2 (src/parse.js, src/parse.test.js)

## Groups
- p03: 2 files, 0 findings
- integration: 2 files, 1 finding

## Checks
- checks/round-2.json: pass

## E2E
- round-2/e2e/verdict.md: Verdict: SKIPPED (no tools.e2e entry)

## Gaps
- None.
```

- The counts per group come from each worker's reply; the checks verdict from the check run's output; the E2E line is the first line of `<round dir>/e2e/verdict.md`, where the E2E tester writes its evidence when given the round's log.
- `Gaps`: a worker that failed twice, an anchor `fallback`, uncommitted files left out of the scope. An empty section holds `- None.`

Done when `round.md` exists.

## 7. Reply

Reply with two lines: the counts line of `"${CLAUDE_PLUGIN_ROOT}/bin/bdk" findings list <log>` and the path of `review.md`.

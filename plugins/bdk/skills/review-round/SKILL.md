---
name: review-round
description: 'One review round of an OpenSpec Change, run by the bdk:lead agent that /bdk:auto-review starts - records the round scope and groups with bdk git groups (a later round covers only the fix commits), runs one bdk:reviewer per group and bdk check run --at review in parallel, then spec-conformance on bdk:verifier, bdk:integration-reviewer and bdk:e2e-tester together (no E2E tester in a later round whose fixes changed only test files after a passing E2E verdict), then bdk:judge, and writes round.md next to the review.md of the judge. Not for users: /bdk:auto-review is the command.'
argument-hint: "<change> --run-dir <absolute path> --round <N>"
user-invocable: false
allowed-tools: Bash(${CLAUDE_PLUGIN_ROOT}/bin/bdk *) Bash(git symbolic-ref *) Bash(git rev-parse *) Read Write Glob Agent
---

Current BDK configuration of this project:

!`"${CLAUDE_PLUGIN_ROOT}/bin/bdk" config show`

Arguments: $ARGUMENTS

# Review round

Run one review round of a Change: its scope, the group reviews and the checks in parallel, then the spec check, the integration review and the E2E check together, then the judge. You compose; the workers review. You never review, level, decide or fix anything yourself, and you add no finding. Run each command on its own, without `;`, `&&` or pipes; run `bdk` as `"${CLAUDE_PLUGIN_ROOT}/bin/bdk"`.

When the block above says `BDK not configured` or `BDK configuration invalid`, reply with that line and stop. If it shows the command instead of its output, run `"${CLAUDE_PLUGIN_ROOT}/bin/bdk" config show` first.

## 0. Run as `bdk:lead`

This skill runs on the `bdk:lead` agent, whose instructions start with "You are `bdk:lead`". When you are not that agent, do nothing: reply that `/bdk:auto-review <change>` runs the review, and stop.

Done when you are `bdk:lead`.

## 1. Read the inputs

- **Change**: the first argument; `openspec/changes/<change>/` must exist, else reply with that and stop.
- **Run directory**: `--run-dir <path>`, an absolute path. Without it, `.bdk/runs/<change>` under the path `git rev-parse --show-toplevel` prints.
- **Round**: `--round <N>`; the round directory is `<run dir>/review/round-<N>`, the log `<round dir>/findings.jsonl`.
- **Settings**: `execution.max-parallel` (default 10) and `models.<role>.model` and `models.<role>.effort` of the roles `reviewer`, `verifier`, `integration-reviewer`, `e2e-tester` and `judge` when the configuration sets them.

When the round directory holds `review.md`, the round is finished: reply with the counts line of `bdk findings list <log>` and the report path, and stop.

Done when you hold the Change, the run directory and the round directory.

## 2. Record the scope

When the round directory holds `groups.json`, reuse it: a rerun reviews the range its first run recorded. Otherwise record it:

```
"${CLAUDE_PLUGIN_ROOT}/bin/bdk" git groups <base> --rounds <run dir>/review --plan <parts> --record <round dir> --json
```

- `<base>`: `git symbolic-ref --short refs/remotes/origin/HEAD` without its `origin/` prefix; else `main`.
- `<parts>`: when `N` is above 1 and `<run dir>/review/round-<N-1>/fixes/parts/` holds part files (`NN.md`), that directory: round `N` reviews the fixes of round `N-1`, grouped by fix part. Otherwise `openspec/changes/<change>/plan/parts`.

Read `groups.json`: `anchor` (`kind` `round` means a fix round; a `fallback` says why an earlier round could not be the anchor), `range`, `files`, `dirty`, `groups`, `tests` (the changed paths that are test files) and `testsOnly` (every changed path is a test file, or nothing changed). Note a `fallback` and any `dirty` file (changed, not committed, so not reviewed) for `round.md`.

Done when `groups.json` exists and you hold its groups.

## 3. Groups and checks in parallel

In one message:

- one Agent call per group other than `integration`: `subagent_type: "bdk:reviewer"`, `run_in_background: false`, prompt `Review group <id> of the round <round dir>`, `model` `models.reviewer.model` and `effort` `models.reviewer.effort`, each when set;
- one Bash call: `"${CLAUDE_PLUGIN_ROOT}/bin/bdk" check run <run dir> round-<N> --at review --changed <base> --round <N>`, with `<base>` of step 2. It runs the items of the `review` point, such as the whole and slow suites, and exits 1 when a check is red and has then appended the red checks to the log; that is a result, not an error.

Start every Agent call in the foreground, with `run_in_background: false` (a call without it may start in the background): you end when your turn ends, and a background worker would report to nobody. Never read or poll a worker's task output file and never sleep to wait for one; a foreground call returns the worker's reply. When the reviewers number more than `execution.max-parallel`, start them in batches of that size, in their order, the check run with the first batch.

A group with no files, or a round whose `groups` is empty (nothing changed since the anchor), gets no reviewer; the checks still run.

A worker that returns an error or an empty reply is started once more with the same prompt. When the second run also fails, note it under `Gaps`.

Done when every reviewer has returned and the check run has ended.

## 4. Spec check, integration and E2E

First decide whether the round **carries the E2E verdict over**. It does only when all three hold:

- `N` is above 1;
- `testsOnly` in `groups.json` is `true`;
- the last E2E verdict reads `Verdict: PASS` or `Verdict: SKIPPED`: Glob `<run dir>/review/round-*/e2e/verdict.md`, take the one of the highest round number below `N`, and read its first line.

Then the fixes since that verdict changed only tests, so the product is the one it checked: start no E2E tester and write no `<round dir>/e2e/`; `/bdk:close` and `/bdk:spec-conformance` keep reading that verdict. In every other case (round 1, any other changed path, no earlier verdict, `FAIL` or `BLOCKED`) the E2E check runs.

Run `git rev-parse --verify --quiet origin/<base>` first, on its own, for the spec check's diff base. Then, as soon as step 3 has ended, start in one message:

- one Agent call for the spec check: `subagent_type: "bdk:verifier"`, `run_in_background: false`, prompt `Run the skill bdk:spec-conformance with the arguments: <change> --base <diff base> --round <round dir>`, where the diff base is `origin/<base>` when `git rev-parse --verify --quiet origin/<base>` prints a commit, else `<base>` of step 2, as `/bdk:close` passes it, so both compare the same diff; `model` `models.verifier.model` and `effort` `models.verifier.effort`, each when set. `/bdk:close` runs the same check before it archives and stops on any problem it finds; run here, its problems land in the round's log, where the judge, triage and the fix pass handle them while the loop can still fix them. It runs in every round, also a fix round or one with no group: a fix of the code or of the spec deltas is checked against the specs again. It reads neither the group findings nor the E2E results;
- when `groups` holds an `integration` group, one Agent call `subagent_type: "bdk:integration-reviewer"`, `run_in_background: false`, prompt `Review the Change as a whole for the round <round dir>`, `model` `models.integration-reviewer.model` and `effort` `models.integration-reviewer.effort`, each when set. It reads what the group reviews found, not the verifier's findings nor the E2E verdict: a problem both log is a repeat the judge levels;
- unless the round carries the verdict over, one Agent call `subagent_type: "bdk:e2e-tester"`, `run_in_background: false`, prompt `Check the Change <change> end to end; the findings log is <round dir>/findings.jsonl`, `model` `models.e2e-tester.model` and `effort` `models.e2e-tester.effort`, each when set.

All of them go into the same message, so none waits for another whose output it does not read: never start the integration reviewer or the E2E tester after the verifier has returned, nor one of the three after another has returned. The verifier is the slowest of them in a typical round, so a later start would add its whole time to the round. When they number more than `execution.max-parallel`, start them in batches of that size, the verifier first. The E2E tester starts only after the check run of step 3 has ended, so the project's suites and the started product never compete for the same machine; the verifier runs nothing on the machine.

A failed run, or a verifier that returns a denied command instead of a verdict, is started once more with the same prompt, as in step 3. A round with no group still runs the spec check, and the E2E check unless it carries the verdict over.

Done when every agent you started has returned.

## 5. Judge

Start one Agent call: `subagent_type: "bdk:judge"`, `run_in_background: false`, prompt `Judge the round <round dir>`, `model` `models.judge.model` and `effort` `models.judge.effort`, each when set. It levels every finding and writes `<round dir>/review.md`. When `review.md` is missing after it returns, start it once more; when it is still missing, write `round.md` (step 6) with the gap and reply that the round has no report.

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

## Spec conformance
- round-2/spec-conformance.md: Verdict: PASS

## E2E
- round-2/e2e/verdict.md: Verdict: SKIPPED (no tools.e2e entry)

## Gaps
- None.
```

- The counts per group come from each worker's reply; the checks verdict from the check run's output; the spec conformance line is the first line of `<round dir>/spec-conformance.md` (`missing` when the verifier wrote none, also a gap); the E2E line is the first line of `<round dir>/e2e/verdict.md`, where the E2E tester writes its evidence when given the round's log.
- A round that carried the verdict over (step 4) has this E2E line instead, with the count of `tests` and the carried file and its first line:

  ```markdown
  ## E2E
  - not re-run: the fix scope holds only test files (2); carried over round-1/e2e/verdict.md: Verdict: PASS
  ```
- `Gaps`: a worker that failed twice, an anchor `fallback`, uncommitted files left out of the scope. An empty section holds `- None.`

Done when `round.md` exists.

## 7. Reply

Reply with two lines: the counts line of `"${CLAUDE_PLUGIN_ROOT}/bin/bdk" findings list <log>` and the path of `review.md`.

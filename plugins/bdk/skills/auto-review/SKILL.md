---
name: auto-review
description: 'Runs the review stage of an OpenSpec Change - review rounds in a bdk:lead (group reviews, checks, E2E, integration, judge), triage of the findings, fix parts and a fix pass through the execute lead, then a next round on the fix scope only - until a round leaves nothing to fix or the round budget is spent, and writes review/result.md. Resumes from the round files. Use when a Change is built and should be reviewed, when asked to "review" a Change or its branch until it is clean, or when /bdk:run reaches the review stage.'
argument-hint: "[change-name]"
allowed-tools: Bash(${CLAUDE_PLUGIN_ROOT}/bin/bdk *) Bash(git rev-parse *) Read Write Glob Grep Skill Agent SendMessage ToolSearch AskUserQuestion
---

Current BDK configuration of this project:

!`"${CLAUDE_PLUGIN_ROOT}/bin/bdk" config show`

Arguments: $ARGUMENTS

# Auto-review

Review a built Change in rounds until no finding is left to fix. Each round and each fix pass runs in its own `bdk:lead`; triage and fix planning run here through their skills. You compose; you never review, level, decide, plan a fix or edit code yourself, and you never start a reviewer, judge, implementer or conformer. The only file you write is `review/result.md`. Read no project source file outside the skills you invoke here (`triage` and `plan-fixes` read what they need): what the code does is the reviewers' and the judge's to say, through the round logs.

## 1. Check the configuration and the Change

When the block above says `BDK not configured: run /bdk:setup` or that the configuration is invalid, stop: start nothing and reply with that line.

- **Change**: the argument. Without one, take the only directory under `openspec/changes/` other than `archive/`; with none or several, name what you found and stop.
- **Queue**: when `.bdk/runs/run.json` exists and queues the Change, run `"${CLAUDE_PLUGIN_ROOT}/bin/bdk" run status --json` and read the Change's entry. Stage `auto-review`: go on. An earlier stage: stop, naming the stage, its reason and its command (`/bdk:<stage> <change>`). `close` or `done`: reply that the review is done and name `/bdk:close <change>`.
- **Run directory**: `.bdk/runs/<change>` under the path `git rev-parse --show-toplevel` prints, as an absolute path.
- **Settings**: `policy.budgets.review-rounds` (default 3), `policy.gates.review`, `execution.lead` (`background` by default) and `models.lead.model` and `models.lead.effort` when set.

Done when you hold the Change, the absolute run directory and the settings, or stopped.

## 2. Find where the review stands

Glob `<run dir>/review/round-*/` and take the highest `N`; the last round is `<run dir>/review/round-<N>/`, its log `findings.jsonl`. Go to the first step that applies:

1. No round: `N` = 1; step 3.
2. The last round has no `review.md`: step 3 for that round (a crashed round runs again).
3. `bdk findings list <log>` counts an undecided finding: step 4.
4. `bdk findings list <log> --decision fix` lists nothing: step 8, `Status: done`.
5. A `fix` decision and `N` at or above the budget: step 8, `Status: blocked` (budget spent).
6. No `<last round>/fixes/index.md`: step 5.
7. `fixes/index.md` lists a finding under `## Not planned`: step 8, `Status: blocked`.
8. `<last round>/fixes/result.md` missing or not `Status: done`: step 6.
9. Otherwise: `N` + 1; step 3.

Done when you know the round and the step.

## 3. Run the round

Tell the user in one line what runs, e.g. `Review round 2 (fix scope of round 1): bdk:lead writes .bdk/runs/add-csv-export/review/round-2/review.md`.

Start one agent with the Agent tool:

- `subagent_type: "bdk:lead"`;
- prompt `Run the skill bdk:review-round with the arguments: <change> --run-dir <run dir> --round <N>`;
- `run_in_background: true` when `execution.lead` is `background`; `run_in_background: false` when it is `foreground`;
- `model` `models.lead.model` and `effort` `models.lead.effort`, each when set.

A background lead reports through a notification that arrives by itself: end your turn and wait for it, without polling its files or sleeping, and do nothing else on this Change meanwhile.

When the lead has returned, `<round dir>/review.md` must exist; otherwise go to step 8 with `Status: blocked`, the lead's last message, and `/bdk:auto-review <change>` to run the round again. Read `<round dir>/round.md` for gaps. Then go to step 4.

Done when the round has its report.

## 4. Triage

Invoke the `triage` skill with the Skill tool, arguments `<round dir>`, plus ` --last-round` when `N` is at or above `policy.budgets.review-rounds`. Follow it to its end.

Then run `bdk findings list <log>`. When a finding is still undecided (manual triage waits for the user), stop: reply with the triage outcome and that `/bdk:auto-review <change>` continues once the findings are decided. Write no result.

Done when every finding of the round has a decision. Go back to step 2.

## 5. Plan the fixes

Invoke the `plan-fixes` skill with the Skill tool, arguments `<round dir>`. Follow it to its end. When `fixes/index.md` lists a finding under `## Not planned`, go to step 8 with `Status: blocked`. Otherwise go to step 6.

Done when `fixes/index.md` exists.

## 6. Fix pass

Tell the user in one line, e.g. `Fixing round 1: bdk:lead builds fix parts 03 from .bdk/runs/add-csv-export/review/round-1/fixes/parts`. Start one agent as in step 3, with the prompt `Run the skill bdk:execute-waves with the arguments: <change> --run-dir <run dir> --parts <round dir>/fixes/parts`, and wait for it the same way.

Read `<round dir>/fixes/result.md`. `Status: done`: go back to step 2, which starts the next round on the fix scope. Missing or `Status: blocked`: go to step 8 with `Status: blocked`, the result's `## Blockers` lines, and `/bdk:auto-review <change>` to retry after their cause is fixed.

Done when the fix pass is done or blocked.

## 7. Repeat

Steps 2 to 6 repeat until step 2 sends you to step 8. A round after a fix pass reviews only the fix commits; it never needs a new decision from you.

## 8. Write the result

Write `<run dir>/review/result.md`, replacing an earlier one:

```markdown
Status: done

## Rounds
- 1: 4 findings (1 blocker, 1 should-fix, 1 nice-to-have, 1 not-a-problem); fix f-9ffca2edd413, f-093cc3ee1fa8; fix parts 03: done
- 2: 0 findings; fix scope of round 1 (2 files)

## Deferred
- f-8c0aba573c66 `src/report.js:13` Report could offer a newest-first month order (nice-to-have)

## Blockers
- None.

## Decisions taken without the user
- Round 1: triage by policy.gates.review auto.
```

- `Status: done` only when the last round holds no `fix` decision; else `Status: blocked`.
- Take the status, the blockers and every round line from the round files and this stage's own stops, never from a worker's reply or from code you or a skill you invoked read. A defect no round log holds has no level and no decision, so it neither blocks the stage nor goes into the result or the reply; a defect counts once a reviewer logs it, and a later round's reviewers log what is there.
- `## Rounds`: one line per round, from `bdk findings list` of its log, its `fixes/index.md` and `fixes/result.md`, and the gaps of its `round.md`.
- `## Deferred`: every finding decided `defer` in any round, with place, summary, level and issue when it has one; `/bdk:close` lists them in the pull request.
- `## Blockers`, each with the command that continues: the budget spent (each finding still decided `fix`, its level; "raise `policy.budgets.review-rounds` and run `/bdk:auto-review <change>`, or change the decision with `/bdk:triage <round dir>`"); a not-planned finding (its reason and `/bdk:design <change>` or the user's decision); a blocked fix pass (its blockers); a round without a report.
- `## Decisions taken without the user`: auto triage, `--last-round` deferrals, round gaps the stage went on with.
- An empty section holds `- None.`

Done when the result exists and its first line is the status.

## 9. Reply

Reply with the status line, the result path, the rounds in one line each, and: on `Status: done`, the next stage `/bdk:close <change>`; on `Status: blocked`, each blocker with its command. Never claim the review is done while a finding is still to fix, and name no defect that no finding holds.

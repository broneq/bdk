# Design

## Context

See proposal.md, "Why". `bdk plan check` (`plugins/bdk/src/plan/`) reads a part's frontmatter and counts its tasks; it reads nothing else of the body. `plan-draft` runs it in step 5 and fixes every problem it lists; `verify-plan` lists every problem as a `Must address` item; `execute-waves` stops only on `wave: null` or a `frontmatter` problem. The two measured plans (#423, kept workspaces) show three failure shapes on part 02: the ending in parentheses in the middle of the line (task 3), a present scenario among unmarked ones on a line ending with the test file (task 4), and one sentence "the four marked present pass at their first run (...)" followed by `node --test ...` (task 5).

## Goals / Non-Goals

**Goals:**
- A plan whose present scenario lacks its ending never reaches the verifier.
- `plan-draft-household-book` passes in 3 of 3 runs on `sonnet` with the ending on every present scenario.

**Non-Goals:**
- Checking that a marker is right: that needs the code, and stays with `plan-draft` and `verify-plan`.

## Decisions

### D1. A `bdk plan check` problem, plus the skill text

The check is a format rule over the part's own text, so it is pure and stable, as the CLI rule asks (`.claude/rules/bdk-cli.md`); the recorded problem is the #423 measurement. `plan-draft` already runs the check and fixes what it lists, so the miss costs one edit inside the planner instead of a verifier round and a planner round.

- Alternative: skill text only. Lost: the rule was already in the skill text; on a B1-sized plan the model kept it in the small case and lost it when one task tested several scenarios, and only the opus verifier caught it.
- Alternative: a check in `verify-plan` only. Lost: that is where it is caught today, at the cost of a round.

### D2. One `Verified by:` line per present scenario

A task that tests several scenarios holds several `Verified by:` lines: one without the ending for the scenarios that are not present, then one per present scenario. The line names that scenario, its test with the exact input and expected result, and ends with the sentence, nothing after it.

- Alternative: one task per present scenario. Lost: part 02 of the measured plans already holds 5 tasks, the default `plan.part.max-tasks`; a task per present scenario would split parts for a format rule.
- Alternative: one line naming every present scenario with the ending. Lost: the implementer cannot tell which test belongs to which scenario, and a mixed line is how task 4 failed.

### D3. What the check reads and matches

Scenarios are the list items under `## Acceptance scenarios` that hold `Scenario: `; the name is the text after the last `Scenario: `, the marker ` (behaviour present)` stripped. `Verified by:` lines are the list items under `## Tasks` that start with `Verified by:`, fenced code skipped (as the task count does). A present scenario passes when a line names it as whole words and ends exactly with the sentence (trailing spaces ignored). A line with the ending names an unmarked scenario when the text before its first `; ` holds that name as whole words, after the present names and code spans are taken out: a test's input or output (`Total: 0.00`) is not a scenario name, and an unmarked name inside a present one ("Total" in "Total of an empty ledger") is not that scenario.

- Alternative: match anywhere on the line in both directions. Lost: a short scenario name such as `Total` or `Balance` appears in expected output, a false problem the planner can only work around by rewording.

### D4. The problem does not block execute

A missing ending makes the implementer stop the part as a plan defect when its test passes, which costs a retry but loses nothing; the order of the work is still known. `execute-waves` notes it like a size problem.

### D5. Grading

`plan-check-clean` already requires a clean `bdk plan check` in the trace, which now holds the ending for every marked scenario. The new `present-endings` grader checks the same independently of the CLI: on the four scenarios both measured plans marked and the verifier confirmed against the code (`No book yet`, `Broken book`, `Bad amount`, `Unknown command`), a `Verified by:` line, written or edited, that names the scenario and ends with the sentence.

## Risks / Trade-offs

- A scenario named in a test description of another present line (direction one matches anywhere) passes without its own line → low: the name must also be on a line with the ending; the verifier still reads the lines.
- `present-endings` fails a run that does not mark one of the four → that is a wrong marker, which the case should not pass either.

## Measurement

2026-10-15, Claude Code 2.1.292 (pinned), clean `HOME`, the `git` entry of "Host limits", `--runs 3 --ablation none --model sonnet -j 3 --keep-temp`. $2.90 of the $5 Budget, 267 s.

| Run | Score | Parts, waves | Marked present (foundation part) | `present-endings` | `present-scenario` problems seen | Part 02 bytes, `max-bytes` problems seen | Cost |
|---|---|---|---|---|---|---|---|
| 1 | 1.00 | 9, 3 | 6 in part 02, each on its own `Verified by:` line | pass | 0 | 02: 8143, 5 over the limit before it fit | $1.03 |
| 2 | 0.86 | 9, 4 | 5 in part 02, each on its own line | pass | 0 | 02: 8160, 3 over the limit before it fit | $0.90 |
| 3 | 1.00 | 7, 3 | 5 in part 01, each on its own line | pass | 0 | 01: 8184, 6 over the limit before it fit | $0.97 |

Read:

1. **The ending.** Every run wrote the ending on a line of its own for every marked scenario; the four graded ones pass in 3 of 3. No run's check ever listed a `present-scenario` problem: the skill text alone kept the rule, and the check is the net for a run that does not.
2. **The failed run** (0.86) lost `plan-check-clean` on the wave count, not on the format: its final check was clean with 4 waves, because part 09 (reports) depends on part 06 for `budgetStatus`, where the #423 plans put the budget module in part 01. This is a choice of the cut that this Change does not touch; filed as #430. The acceptance signal "3 of 3" is met for the ending and missed for the case score.
3. **Cost of the rule.** One line per present scenario costs bytes in the part that holds them, the foundation part (02, or 01 in run 3): it went over `plan.part.max-bytes` in 3 of 3 runs before the planner trimmed it, and ended at 8143, 8160 and 8184 of 8192. The #423 `sonnet` plan was already at 8164 without the extra lines, so the part was at its limit before; #430 holds the observation.
4. **No verifier round.** The format the #423 verifier failed is now checked by `bdk plan check`, whose final run was clean in all three workspaces; the Budget does not cover a `/bdk:verify-plan` round per plan.

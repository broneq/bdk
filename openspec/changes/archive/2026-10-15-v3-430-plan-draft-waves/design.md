# Design

## Context

See proposal.md, "Why". `plan-draft` step 3 cuts the parts; step 5 runs `bdk plan check`, whose `parts:` rows print each part's bytes against `plan.part.max-bytes`. The fixture's design (`household-book.sh`) has D9 reuse `budgetStatus` of D7, so a plan that puts `src/budgets.js` in the budget feature's part makes the reports part depend on it. In the #427 measurement that edge sat on a chain foundation -> 0x -> 06 -> 09 in one run of three (4 waves). The kept workspaces of #427 were gone when this Change started, so the cause of the 06 edge is read from that design, not from the parts.

## Goals / Non-Goals

**Goals:**
- `plan-draft-household-book` scores 1.00 in 3 of 3 runs on `sonnet`, and no run's foundation part ends within 2% of `plan.part.max-bytes` (the issue's acceptance signal).

**Non-Goals:**
- A CLI check of the room: the CLI never blocks a skill, and `bdk plan check` already prints the bytes.

## Decisions

### D1. A shared function is a contract, and the longest chain is walked

Step 3 item 1 already put "contracts several parts need" first, and the #423 plans and two #427 runs did so for the budget module. The failing run read a contract as a type or a signature. The text now names a function another feature's part calls as a contract that goes to wave 1 with its unit tests, and a new last item walks the longest chain and drops an edge that exists only for such a function. The example in the skill stays generic ("a report that reuses another feature's computation"), so the case does not grade a fixture name planted in the skill.

- Alternative: leave it (the variance may be acceptable). Lost: a fourth wave costs a full wave check per run on every Change shaped like this one, and the fix is a sentence.
- Alternative: a `bdk plan check` warning on a chain deeper than three. Lost: the check cannot tell a needed edge from one that exists for a function, and the depth is already printed.

### D2. Room: seven eighths of `max-bytes`, made by moving leaf work out

A part at its limit leaves the verifier's fixes no room (the #423 verifier said so under Should consider). Each part keeps one eighth free: 7168 bytes of the default 8192, which clears the issue's 2% margin (8028) with room for a fix of about a kilobyte. The room comes first from moving out work no other part uses (in the fixture, `add` and `balance` and their CLI tests can leave the foundation for wave 2 without deepening a chain of three), then from a split, and only last from trimming facts. A fix round of step 6 may use the room.

- Alternative: raise the default `plan.part.max-bytes`. Lost: the planner fills to the limit, so the part ends at the new edge with the same lack of room, and the limit is there because agents handle smaller parts better.
- Alternative: trim harder. Lost: the three #427 runs already trimmed to fit, losing facts the implementer reads.

## Risks / Trade-offs

- More parts in wave 2 -> no deeper chain: the move applies only when the wave is no deeper than the longest chain already is.
- A leaf command moved out of the foundation takes its present scenarios with it -> they follow the test file (step 3 item 6), so ownership stays one part.

## Measurement

2026-10-15, Claude Code 2.1.300, clean `HOME`, the `git` entry of "Host limits", `--runs 3 --ablation none --model sonnet -j 3 --keep-temp --max-cost-usd 5`. $2.45 of the $5 Budget, 285 s. No probe or repeated run.

| Run | Score | Parts, waves | Where `budgetStatus` went | Foundation part bytes | Largest part | Cost |
|---|---|---|---|---|---|---|
| 1 | 1.00 | 9, 2 | 02, wave 1, a part of its own | 01: 4457 | 4458 (03) | $0.77 |
| 2 | 1.00 | 10, 2 | 02, wave 1, a part of its own | 01: 7111 | 7111 (01) | $0.76 |
| 3 | 1.00 | 9, 3 | 01, wave 1, with `src/dates.js` | 02: 6114 | 6707 (07) | $0.92 |

Read (waves, bytes and goals from `bdk plan check` and the parts of each kept workspace):

1. **Waves.** Every run put `budgetStatus` in a wave-1 part, and no report part depends on the budget commands' part; two runs reached 2 waves, one fewer than any #423 or #427 plan. Run 3 made the book and dispatcher (02) depend on the pure modules of 01, an edge the cut did not need, and still stayed at 3.
2. **Room.** No part of any run is within 2% of 8192 (8028); the largest is 7111, under the seven eighths of D2. Runs 1 and 2 moved `add` and `balance` with their CLI tests out of the foundation into a wave-2 part (03), as D2 expects; run 3 moved the rewritten `test/cli.test.js` into a wave-3 part of its own (03, 4398 bytes).
3. The acceptance signal is met: 1.00 in 3 of 3, no foundation part near the limit.

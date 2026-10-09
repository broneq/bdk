## Context

Tracks #367. A review round after a fix pass covers only the fix commits (spec `bdk-auto-review`, "A later round covers only the fix scope"); `review-integration` then checks only the scenarios and contracts the changed files reach (spec `review-blocks`, "Fix parts and fix rounds"). Nothing said what happens to a defect the integration reviewer sees outside those files while it follows a contract. In `auto-review-test-only-fix` the round-2 reviewer saw the seeded cents bug of `monthly-report`, did not log it, and mentioned it in its reply; `/bdk:auto-review` then read the code itself and wrote `Status: blocked`, which its own step 8 gives only for a `fix` decision. Architecture: logic in skills, one block one job (`docs/design/2026-10-07-v3-architecture.md`); the orchestrator composes and never reviews.

## Goals / Non-Goals

**Goals:** a defect a reviewer sees is either a finding with a level and a decision or nothing; the stage result always agrees with the round files.

**Non-Goals:** widening a fix round's scope; changing `review-group` (it reviews only its group's files and leaves the rest to `review-integration`); changing the judge's levels or triage.

## Decisions

### D1. The integration reviewer logs what it sees outside the fix scope

The issue asks to choose between logging such a defect and ignoring it. Logging it wins: v3 exists to check the product against what it is meant to do (CLAUDE.md, problem 2), and a defect seen and dropped is the worst outcome - it reaches the pull request without a trace. The cost is bounded: the reviewer does not search outside the scope (the fix round stays fast), it only logs what following a changed scenario or contract shows. The finding goes through the normal path: the judge levels it (`not-a-problem` when the code is outside the Change's scope, its existing rule), triage decides it, and on the last round a `blocker` stops the stage `blocked` with the budget command, so the user sees it in `review/result.md` under `## Blockers`. The evidence says "outside the fix scope" so the judge and the user see why a test-only round has a product finding.

Rejected: ignoring it. The round would stay fast and clean, but the stage would end `done` over a defect a reviewer saw, and the reply would carry it as an unlevelled note or not at all.

### D2. No repeat of an earlier round's finding

Logging outside the scope makes repeats likely: a finding round 1 already decided `accept` or `defer` lies outside the next fix scope by definition. The reviewer reads the logs of every earlier round (`bdk findings list`) and logs nothing that one of their findings names, whatever its decision, so a decided finding is never raised again. The judge's repeat rule covers only one log, so this check belongs in the reviewer.

### D3. The return names only logged findings

The reviewer's reply is read by the round lead and, through it, by the main session. A problem described there without a log entry is what led `/bdk:auto-review` to its own reading. The return lists only the ids it appended.

### D4. The stage result comes from the round files only

`/bdk:auto-review` step 8 already derives the status from the log; the observed run broke it by reading source code. The skill now says plainly: read no project source file outside the skills it invokes; neither a worker's reply nor code read in the main session changes the status, adds a blocker or appears as a defect in the result or the reply; a defect counts only as a finding in a log.

`triage` and `plan-fixes` run in the main thread and read code (`plan-fixes` traces each `fix` finding to plan it), so a ban on reading source in the main session would contradict them. The first measurement showed exactly that path: in 3 of 3 runs `plan-fixes` read `src/parse.js`, saw the seeded parse bug and the main session named it in its reply as "a likely bug no reviewer logged". The rule therefore binds what reaches the result and the reply, not what is read. Since #265 every round runs `spec-conformance`, so a defect the main session saw is also one a later round's verifier or reviewers log, and then it counts. This keeps the orchestrator to its one job (compose) and makes the result reproducible from the files.

### D5. Eval cases

- New block case `review-integration-outside-fix-scope` on `monthly-report`: round 1 triaged (the parse bug `f-9ffca2edd413` decided `accept` with a reason, the test gap decided `fix`), fix part 03 and its commit to `src/parse.test.js`, round 2 recorded by hand (as `monthly-report.sh` records round 1) with groups `p03` and `integration` and an empty log. Graders: an `llm` grader on the round-2 log for the cents and dollars seam marked outside the fix scope; a `regex` grader with `match: not_contains` for a new finding on the fewer-decimals parse bug; no `Edit`; the skill fired. Run both arms to show the effect.
- `auto-review-test-only-fix` gets the `result-agrees` grader: a `regex` over `review/result.md` that accepts `Status: done` with no `fix f-` on the round-2 line, or `Status: blocked` with one. Whether round 2 sees the seeded bug varies by run; both outcomes are right as long as the result follows the log. The `reply` grader already accepts both.

### D6. The lead runs single commands

In 1 of 3 runs of the first measurement the fix-pass lead chained `bdk plan check ...; echo "exit $?"; ls ...` into one Bash call; the eval grants allow single commands, the call was refused, and the stage ended `blocked` with no round 2. `execute-waves` already asks for single commands; the rule moves into `agents/lead.md` too, so every stage skill a lead runs inherits it. A flake of the acceptance case, fixed in passing (CLAUDE.md: fix test flakiness you see).

## Risks / Trade-offs

- [A fix round may log more findings and so need one more round or end `blocked` on the last round] - that is the correct outcome for a defect in the Change; the budget command and `/bdk:triage` give the user the way on.
- [The reviewer may still miss an out-of-scope defect] - accepted: round 1 reviews the whole Change; a fix round does not promise a second full review.

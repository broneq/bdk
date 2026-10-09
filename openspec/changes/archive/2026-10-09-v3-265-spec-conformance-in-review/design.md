# Design

## Context

See proposal.md - Why. The review round (`plugins/bdk/skills/review-round/`, #201) runs the group reviewers and `bdk check run --at review` in parallel (step 3), then the E2E tester and the integration reviewer (step 4), then the judge; `/bdk:auto-review` triages, plans fix parts with `plan-fixes` and builds them through `execute-waves`, and repeats until nothing is left to fix or `policy.budgets.review-rounds` is spent. `spec-conformance` (#196) runs only in `/bdk:close` step 3 and stops the close on any `Must address` item.

In run 1 of #208 the integration reviewer had the same inputs as `spec-conformance` but a different question: it checks the scenarios against the product and the parts against each other, with the design and the plan as intent. The undocumented error messages were in the design (part 01's `readAmount` and `readDate`), so "behaviour no scenario or intent names" did not fire; the path defect sat in a requirement sentence whose only scenario used a relative path, so "compute the scenario's own input" did not fire either. `spec-conformance` asks whether the spec text, read alone, is true of the product, and found both.

## Goals / Non-Goals

**Goals:**

- The problems close would refuse are found and fixed inside the review loop, through the judge, triage, `plan-fixes` and the fix pass, so an unattended run reaches close with specs that pass.
- Close stays the final gate and does not change.

**Non-Goals:**

- A new CLI command or flag.
- Making the integration reviewer or `conform-part` read the spec text the way `spec-conformance` does.
- E2E paths with absolute paths (the E2E tester's own path choice).
- The B1-sized end-to-end run (follow-up issue, see Risks).

## Decisions

### D1. Where the check runs: `spec-conformance` itself, as a worker of every review round

Decided without the user: the issue lists three places. The round runs the same block close runs, with `--round <round dir>`.

- Alternative: widen the integration reviewer's step 3 with the six problems of `spec-conformance` - lost: two opus readers of one Change with overlapping questions in one block break "one block, one job", and nothing measured shows the integration reviewer would find what it missed in run 1; the block that found M1-M4 is `spec-conformance`, so close and the round would still ask different questions and close could still refuse what the round passed.
- Alternative: `conform-part` checks its part against the spec text - lost: a part sees only its own files and scenarios; "no delta describes this error message" and "this requirement sentence is broken for an absolute path" are judgements over the whole Change, and the plan defect of run 1 was shared by the part and its conformer.
- Alternative: run it only in the last round, as the issue suggests - lost: the last round's fixes get no further round (`--last-round` defers `should-fix`, and a `blocker` decided `fix` in the last round stops the stage `blocked`), so a finding there would stop the run at review instead of at close. Every round gives each finding a round to be fixed in and a round that checks the fix, which is how M4 (a wrong spec fix) is caught before close.

The same check in the round and at close makes the gate predictable: close fails only on what changed after the last round, which a finished review leaves nothing of.

### D2. The verifier starts with the group reviewers (step 3), not with the E2E tester (step 4)

It runs nothing on the machine, so it does not compete with the check run, and its findings are in the log before the integration reviewer starts, which skips problems already logged (`review-integration` step 1). It does not read the E2E results (D3), so it does not need step 4. Its time (110 s in #208, opus) overlaps the reviewers and the check run, so the round's wall clock does not grow when those take longer, which they did in every measured round.

- Alternative: step 4 next to the E2E tester and the integration reviewer - lost: the integration reviewer would repeat its contradicted scenarios and the judge would level the repeats `not-a-problem`, work spent twice.
- Alternative: after the E2E tester, to read its verdict - lost: the E2E tester logs its failures itself, so problem 2 of `spec-conformance` would only duplicate them; it would also add 110 s after the slowest step of the round.

### D3. Round mode reads no E2E results

In a round, problem 2 ("E2E failure") is already a finding of source `e2e`. Close keeps reading the latest round's E2E verdict, unchanged.

### D4. Findings go into the log through `bdk findings add`, written by the verifier

`spec-conformance` appends one finding per `Must address` item, `--source spec-conformance`, at the place the fix goes: the code line when the code breaks what the proposal asks for, the requirement's line in the spec delta when the delta misses or misstates what the proposal and the design settle. This is the "which side disagrees with the intent" decision the block already makes at close, turned into a place.

- Alternative: the lead reads `spec-conformance.md` and adds the findings - lost: the lead composes and adds no finding (`review-round` "You never review ... and you add no finding").
- Alternative: a CLI command `bdk findings import <report>` - lost: no measurement shows a need (CLAUDE.md "Building skills (v3)"); the verifier already runs `bdk`, and the narrow grant `Bash(*/bin/bdk *)` covers `bdk findings add`.
- The `bdk:verifier` agent keeps "check, never fix": appending a finding is reporting. Its rule gains one exception, `bdk findings add` on the log its skill names (spec `bdk-verifier`).
- No `--rule`: the judge reads `--rule` as a rule or an instruction file to look up, and dedupe by summary is enough within one round.

### D5. The judge levels a holding `spec-conformance` finding `blocker`

An undocumented error message is a product that works, which the current table would level `should-fix`; with `--last-round` triage defers it, and close then refuses to archive. A problem close refuses is a problem the run cannot ship with, whatever its effect on the user, so it is a `blocker`, and triage fixes it whatever the budget. The judge still checks it: both sides, the spec location and the code for the evidence's input; a finding where they agree is `not-a-problem`.

- Alternative: a new level or a triage rule by source - lost: the level table is the one place the judge's and triage's policy meet; a source rule in triage would bypass the judge's check.

### D6. `plan-fixes` plans spec-delta fixes

`plan-fixes` declared a finding "not plannable when its fix needs a spec or design change". A finding that the delta does not list an error message the design already gives every command needs a spec change, so the run would stop at review instead of at close. The rule now separates documenting what is settled (plannable: a task on the delta file, `Verified by:` the next round's spec conformance, no test because the task changes spec text only) from deciding what is not (not plannable: the behaviour contradicts another scenario, the proposal or the design, or none of them settles it).

The implementer edits the delta like any file of its part. A part that only changes spec text has no acceptance scenario, so `implement-part` writes no test, and the next round's verifier is its check. The verify pass of this Change suspected that `implement-part` would stop such a task as a plan defect (it disagrees with the current requirement text) and that `conform-part` would fail it for its missing test, and proposed exceptions in both skills. The block cases `implement-part-spec-delta` and `conform-part-spec-delta` (fixture `tally-spec-fix-part`) were written first: the unchanged skills pass both (1.00 each), so neither skill changes; the cases stay as regression cover for the path D6 opens.

### D7. Requirement text, not only scenarios

The path defect broke a SHALL sentence ("a path absolute or relative") whose scenario used a relative path. `spec-conformance` step 3 now checks each SHALL sentence for every input class it names. This holds in both modes; close would have found it either way in #208, but it makes the round find it for the same reason close did, not by chance.

### D8. Eval fixture: `tally-ledger-path.sh`

A small fixture on top of `tally-change.sh` reproduces both defects of run 1: the proposal asks for a short error on a bad amount and for `TALLY_LEDGER` (absolute or relative), the delta documents `TALLY_LEDGER` with a relative-path scenario only and lists no error, and the code prints `tally: not an amount: <text>` and joins `TALLY_LEDGER` to the current directory. Three block cases use it (`spec-conformance-round`, `judge-spec-conformance`, `plan-fixes-spec-delta`), each covering one changed block; `auto-review-first-round` gains graders that the round started the verifier in the foreground and that its report exists.

- Alternative: reuse `monthly-report` - lost: its Change has no error message or path behaviour, and its seeded bugs are the group and seam bugs other cases grade.

## Risks / Trade-offs

- [One more opus agent per round] -> It runs in parallel with the reviewers and the check run (D2); `models.verifier` lowers its model for a project that wants it cheaper. Close's own run stays, about 110 s.
- [The verifier sees the whole Change in a fix round, not only the fix scope] -> Accepted: the deltas and the product are judged as a whole by close too; a narrower check could pass what close refuses.
- [A finding whose fix side is wrong (the verifier puts a code defect on the delta)] -> The judge checks both sides, and `implement-part` stops on a task that contradicts a scenario.
- [The acceptance signal "the B1-sized run reaches its PR without a stop at close" needs the uncorrected run-1 fixture of #208 and a 30-minute paid run] -> Follow-up issue; the block cases on the small fixture prove the mechanism.

## Measurement

2026-10-09, Claude Code 2.1.295, `claude plugin eval` with the clean `HOME` and the git prefix of the eval README's "Host limits".

Before the change (the skills of `staging/v3`, the new cases copied in, one run each, with the plugin): `spec-conformance-round` 0.71 (the verifier wrote `close/spec-conformance.md`, no round report), `judge-spec-conformance` 0.80 (the undocumented error message `should-fix`), `plan-fixes-spec-delta` 0.67 (the spec-delta fix under `## Not planned`).

After, 3 runs per arm:

| Case | WITH | W/OUT | Δ | Cost |
|---|---|---|---|---|
| `spec-conformance-round` | 1.00 | 0.61 | +0.39 | $2.17 |
| `judge-spec-conformance` | 1.00 | 0.25 | +0.75 | $1.35 |
| `plan-fixes-spec-delta` | 1.00 | 0.20 | +0.80 | $1.63 |
| `implement-part-spec-delta` | 1.00 | 0.50 | +0.50 | $1.45 |
| `conform-part-spec-delta` | 1.00 | 0.00 | +1.00 | $1.51 |

Regression, one run each with the plugin: `spec-conformance-conforming`, `-contradicted`, `-undocumented`, `-model-set`, `judge-levels`, `judge-instruction`, `plan-fixes-judged-round` all 1.00; `auto-review-first-round` 1.00 (139 s, $1.21) with the new graders `verifier-in-round` and `conformance-written` and the verifier in `workers-foreground`.

After the verify pass (design.md read for placement, the item ID in the evidence, the diff base of close, the verifier's denied-command retry) and the rebase on #264 and #263, one more series: `spec-conformance-round` 3 runs per arm, WITH 1.00, W/OUT 0.67, Δ +0.33, $2.23; one run each with the plugin: `spec-conformance-conforming`, `-contradicted`, `-undocumented`, `-model-set` 1.00, `auto-review-first-round` 1.00 (with #263's `integration-with-e2e` grader).

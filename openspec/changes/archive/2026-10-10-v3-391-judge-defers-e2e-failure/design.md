# Design

## Context

See proposal.md - Why. `/bdk:e2e-check` logs each failed path as an `e2e-check` finding at the proposal line it comes from, with the path file `E2E/<process>--<path>.md` in its evidence; a `break` path whose outcome nothing states is held to a baseline (no crash, no stack trace, a visible refusal). `/bdk:judge` levels it by the table of step 3, whose `blocker` row names "the intent of the Change" but whose only source-specific rules are for `spec-conformance` and test gaps. `design.md` can narrow a promise as well as a delta (the case's design decides `total` does not check each entry), so the rule names both. `/bdk:spec-conformance` at close reads the latest E2E verdict and makes every path with `Result: fail` a `Must address` item (problem 2), so close refuses the archive while any path fails. #265 design D1 makes the review round the place where close's problems are fixed, so a round must not defer what close refuses.

## Goals / Non-Goals

**Goals:**

- A round fixes every E2E failure that holds, so close does not stop on a finding the review already saw.
- The judge does not lower an E2E failure because a delta words the promise more narrowly than the proposal.

**Non-Goals:**

- Changing `/bdk:close` or `/bdk:spec-conformance`: close keeps refusing every failed path.
- Changing triage, `plan-fixes` or the fix pass: a `blocker` is already `fix` in every round, and `plan-fixes` already traces a finding without a code place from its evidence and leaves a fix that needs a product decision to the user.
- Changing the E2E tester: its paths and the baseline stay as they are.

## Decisions

### D1. Make the judge agree with close: a holding `e2e-check` finding is a `blocker`

The issue offers two ways to make round and close agree: the judge levels an E2E failure high enough to be fixed, or close does not re-fail a finding the review decided on. The judge side is chosen.

- Alternative: close skips a failed path whose finding the review deferred or accepted - lost: the PR would ship a product that breaks a promise of its own proposal (the measured `NaN.NaN` and stack trace), with only a line in the PR body to show it; close's check exists to stop exactly that, and the measurement points the same way (issue #391, Scope).
- Alternative: level it `should-fix` - lost: auto triage defers a `should-fix` finding in the last round the budget allows (`--last-round`), and close would refuse it there; the issue's own reason for the first option is that a deferred one is still refused. `blocker` is `fix` in every round, and with the budget spent the review ends `blocked`, which names the problem at review instead of at close.
- Alternative: `blocker` only when the path's expected outcome comes from a delta or the proposal, and a lower level for a `break` path held to the baseline - lost: close refuses a baseline path as much as any other (it reads `Result: fail`, not `Expected from:`), and a crash or a wrong value printed with exit 0 is a broken product by every reading of the intent.

The rule follows the existing `spec-conformance` rule of the same table: a finding close would refuse is a `blocker` "even when the product works" (#265). An `e2e-check` finding is stronger still: the tester saw the product fail.

### D2. A proposal that promises more than the delta: the code is fixed in the round

A proposal line is the Change's intent; a delta that does not name an input of that promise is a gap of the delta, not a narrower promise. So when the tester fails a path of that line, the judge levels the finding as the product breaking the intent, and `plan-fixes` plans a code fix from the proposal's behaviour (the measured case: refuse `[{"amount":"x"}]` with `cannot read ledger.json`, exit 2). The next round's spec check then sees behaviour no delta describes and logs it as a `spec-conformance` finding, fixed as any other. When the proposal does not settle the behaviour (two readings of the promise), `plan-fixes` already marks it not plannable and leaves it to the user.

- Alternative: treat it as a proposal defect and narrow the proposal in the round - lost: narrowing a promise changes what the Change is for, a product decision; the fix pass never makes one (`plan-fixes`: "a fix that needs a product decision is left to the user"). With `policy.gates.review: manual` the user can still decide so.

### D3. When an `e2e-check` finding holds

It holds when the code, traced with the path's input from its `## Steps`, gives what its `## Observed` says (a crash, a wrong text, a wrong exit code). The judge cannot run the product, so the path file is the evidence and the code is the check, as for every other source. A finding whose observation the code does not give is `not-a-problem`, by the existing rule that a finding which would be a `blocker` but does not hold is `not-a-problem`, never a lower level.

Known gap, not fixed here: a judge that levels an `e2e-check` finding `not-a-problem` leaves the path file at `Result: fail`, and close still refuses it. The measurement showed no such case (the tester's observations held); it is filed as #396 rather than widened into this one.

### D4. Eval case: `judge-e2e-failure` on a new fixture `tally-broken-ledger.sh`

The block case reproduces the measured shape at block size on the `tally` fixtures every judge case uses: `tally-change.sh` plus one commit whose proposal promises that `tally total` refuses a broken ledger (`tally: cannot read ledger.json`, exit 2, instead of a wrong total), whose delta says so only for a file that is not valid JSON or not an array, whose `design.md` decides that `total` does not check each entry ("only `tally add` writes the ledger"), and whose code checks just that. Round 1 holds the E2E tester's evidence (`e2e/verdict.md` and two failed `break` path files) and its two unleveled `e2e-check` findings: `["abc"]` crashes with a `TypeError` stack trace (exit 1), `[true, 5]` prints `Total: 6.00` (exit 0). The graders read both levels as `blocker`, the round report written, no `Edit`, no denied call, skill fired.

Measured before the skill change (sonnet, 3 runs): a first version whose proposal line read "... exits 2 instead of printing a wrong total" and whose path files said `Expected from: baseline` scored 1.00 even with the narrowing design; the judge read the promise straight from the line. With the line worded as the measured one ("refuses a broken ledger (`tally: cannot read ledger.json`, exit 2)") and the expectation taken from the proposal, two runs of 3 levelled both findings below `blocker` (0.78). That version is the case. After the change: 1.00 in 3 of 3, and every other `judge-*` case keeps its levels.

- Alternative: extend `tally-ledger-path.sh` - lost: its defects are the `spec-conformance` ones `judge-spec-conformance` and `plan-fixes-spec-delta` grade; a second kind of defect in it would change what they read.
- Alternative: a control finding whose observation does not hold - lost: no measurement showed a tester observation that the code does not give, and it would grade D3's second sentence, which is the existing rule `judge-levels` already covers (a crash a guard prevents).

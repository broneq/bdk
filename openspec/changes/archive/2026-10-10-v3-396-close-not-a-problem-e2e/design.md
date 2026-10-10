# Design

## Context

See proposal.md - Why. A review round logs each failed E2E path as an `e2e-check` finding whose evidence starts with the path file (`.bdk/runs/<change>/review/round-<N>/e2e/<process>--<path>.md: expected ..., observed ...`, spec `bdk-e2e-check`), and the round's judge levels it (#391: `blocker` when the code gives the observation, `not-a-problem` when it does not). Auto-review ends `done` when the last round holds no `fix` decision, so a round whose only E2E findings are `not-a-problem` is the last one, and its `FAIL` verdict stays the latest. A round carries a verdict over only when it is `PASS` or `SKIPPED` (review-round step 4), so a `FAIL` verdict is always that of the last round that ran E2E. At close, `/bdk:spec-conformance` reads the latest verdict and makes every path file with `Result: fail` a `Must address` item. `bdk findings list <log> --json` already prints each finding's `source`, `evidence`, `level` and `levelReason`.

## Goals / Non-Goals

**Goals:**

- Close passes a Change whose only E2E failures the last review round judged `not-a-problem`, as #265 design D1 asks: close fails only on what changed after the last round.
- The pull request still shows that the verdict failed and why close let it pass.

**Non-Goals:**

- Changing the judge, triage, the review round or the E2E tester.
- Passing a failed path whose finding holds but was deferred or accepted: #391 design D1 keeps close refusing it.

## Decisions

### D1. Close reads the review's level of a failed path's finding

The issue offers two sides. Close is chosen: the spec check at close treats a failed path of a round verdict as cleared when that round's log holds at least one `e2e-check` finding whose evidence names the path file, and every such finding is levelled `not-a-problem`.

- Alternative: the round side, a fresh E2E verdict before the review ends (a next round re-runs E2E when the last verdict failed and nothing was fixed) - lost: it re-runs the whole E2E check, the slowest worker of a round, for a finding the judge already traced to a tester error (goal "speed" of v3), and the tester can make the same error again, so the review would loop until the budget is spent and close would still refuse. It also needs a round with no fix commit, which `bdk git groups` reports as empty.
- Alternative: the judge rewrites the path file to `Result: pass` - lost: the judge changes no file (spec `review-blocks`), and the path file is the tester's evidence of what it saw; rewriting it would hide the observation from the pull request.
- Alternative: clear a path on any level other than `blocker` - lost: since #391 a holding E2E finding is a `blocker`; any other level means a judge that did not follow that rule or a user decision, and #391 design D1 keeps close refusing a holding failure that was deferred.

The level is read, not the decision: `not-a-problem` says the observation does not hold, which is what makes the path not a broken promise. A finding levelled `not-a-problem` and decided anything is cleared; a `blocker` decided `defer` or `accept` is not.

### D2. Only a round verdict, only the round's own log

A path is matched only against the log of the round whose `e2e/` holds it (`review/round-<N>/findings.jsonl` next to `review/round-<N>/e2e/`). A standalone `/bdk:e2e-check` (`.bdk/runs/<change>/e2e/`) has no judge, so its failed paths stay items. A path is matched by its file name (`<process>--<path>.md`) in the finding's evidence, the form `/bdk:e2e-check` writes; a finding without the file name does not clear the path.

- Alternative: match by the proposal line (`file` and `line` of the finding) - lost: several paths of one process share the proposal line (the #391 case had two failed paths of `proposal.md:9`), so one cleared finding would clear another path's failure.

### D3. The cleared paths are reported, not hidden

The report lists each cleared path under `Checked` on its `E2E:` line, with the finding id and the judge's `levelReason`, and close copies that line into the pull request body next to `Verdict: FAIL`. The verifier judges from the code and the E2E results; the level is the review's decision, so the report names it as such and the reviewer of the pull request can weigh it.

- Alternative: the verifier re-traces the cleared path itself and keeps it an item when it disagrees with the judge - lost: two judges of the same finding, and close would again fail on what the review already decided; the verifier still checks every delta scenario against the code, so a path whose input a scenario covers is checked anyway.

### D4. Eval cases on one new fixture `tally-e2e-cleared.sh`

The fixture is `tally-reviewed.sh` (conforming `add-total`, an offline `origin` and `gh`) with round 1's E2E verdict turned `FAIL`: the path `see-the-total--empty-ledger.md` reads `Result: fail` with an observation the code does not give (exit 1, `tally: no ledger here`; the code prints `Total: 0.00`), its `e2e-check` finding levelled `not-a-problem` and decided `accept`, and `review/result.md` `Status: done`.

- `close-e2e-cleared` (orchestrator, the acceptance signal): `/bdk:close` on the fixture ends with the archive and a pull request whose body holds `Verdict: FAIL` and the cleared path.
- `spec-conformance-e2e-cleared` (block): the fixture plus a second failed path, `see-the-total--boolean-entry.md` (`[true, 5]` prints `Total: 6.00`, exit 0, which the code gives), its finding levelled `blocker` and decided `defer`. The report must name the `boolean-entry` path under `Must address`, not the `empty-ledger` one, and name the cleared one under `Checked`.

Measured (Claude Code 2.1.292, `--ablation none`, 3 runs): before the skill change both cases 0.83 in 3 of 3. The issue's stop did not show at this size: the opus verifier kept the cleared path out of `Must address` against its own rule, after tracing the observation itself, and put it under `Should consider`; so the gap was a verifier's judgement call against its text, not a rule, and the pull request said `Verdict: FAIL` with nothing next to it. After the change both 1.00 in 3 of 3, and every other `spec-conformance-*` and `close-*` case 1.00 in 1 run. A larger or weaker setup (a sonnet verifier through `models.verifier`, a subtler tester error) is where the old text would stop close; it is not measured here.

- Alternative: one case only - lost: the block case grades the split (a cleared path next to a deferred blocker), the orchestrator case grades the issue's acceptance signal end to end; neither shows the other.

## Risks / Trade-offs

- A judge that wrongly clears a real failure lets close pass a broken path → the pull request body names every cleared path with the judge's reason next to `Verdict: FAIL`, so the human reviewer sees it; the judge's rule for `e2e-check` (#391) requires a trace of the path's input through the code.
- A user commit after the last round is not covered by the cleared level → as for every other E2E result, close checks the deltas against the code; a later E2E run would replace the verdict.

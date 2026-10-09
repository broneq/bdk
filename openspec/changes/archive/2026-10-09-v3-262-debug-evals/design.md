## Context

Tracks #262. `/bdk:debug` (v3-204, spec `bdk-debug`) has four orchestrator and block eval cases; the scenarios "Fix too large for one part" and "Resume after the fix" have none (v3-204 design, "Measurements"). The same measurements record one `debug-fix` run at 0.91: its `test-red-then-green` grader (`execute/part-01.md` must hold `red seen; green seen` under `## Acceptance tests`) did not match, and the workspace was gone.

### What the rerun showed

`debug-fix` was run three times with `--keep-temp` (Claude Code 2.1.292, `-j 3`, clean `HOME` and the git shell prefix of the eval README's "Host limits"):

| Run | Score | What happened |
|---|---|---|
| 1 | 1.00 | One acceptance test, `red seen; green seen`. |
| 2 | 1.00 | Two acceptance tests. The line of the reproduction test reads `red seen (run red for the file; only the text-ledger failure printed in the output, the add test failed on the same toFixed crash by construction); green seen`. The grader passed only because the second line held the exact phrase. |
| 3 | 0.18 | `openspec new change` hung in the run's sandbox, and so did `openspec --version`; `diagnose-bug` stopped `Status: blocked` as it should. A host problem, not this Change's (#341). |

Run 2's implementer transcript shows the cause. `bdk check run ... 01-red` printed, under the red check, the last 20 lines of `npm test` output (`tail`). `node --test` lists every failure at the end, so the 20 lines held only the second test's failure; the first test's failure sat above them. The implementer never read the output file (step 4 of `implement-part` says "Read the output file of each red check"), went on to the fix, and hedged the report line instead of writing what it had seen. With one acceptance test, the same hedge is exactly the 0.91 run: the only line lacks `red seen; green seen`. So the skill's run went wrong, and the grader was right to fail it; but the grader was also too lenient, since any one line with the phrase passes a part with several tests.

## Goals / Non-Goals

**Goals:**
- One eval case per uncovered scenario, each passing 3/3 with the plugin.
- The cause of the `test-red-then-green` miss removed where it starts, and the graders strict enough to catch it.

**Non-Goals:**
- Cases for "Not configured" and "Dirty tree" (a stop on the first step, as in every orchestrator; v3-204 "Measurements").
- The `openspec` hang in eval sandboxes (#341).

## Decisions

### D1. `debug-too-large` makes the fix too large with `plan.part.max-files: 1`

The scaffold is `tally-bug.sh` plus `.bdk/settings.local.yaml` with `plan.part.max-files: 1` and `policy.gates.design: auto`. The fix touches `bin/tally.js` and a test file, two files, so `diagnose-bug` step 4 must call it too large; the auto gate makes sure that a run that wrongly goes on is caught by the graders (no `gate.md`, no `commit`/`execute`/`auto-review` Skill call, `bin/tally.js` unchanged) rather than stopped by a question.

Alternatives: a new fixture whose bug needs a choice between two behaviours the user should make (the other too-large trigger). It tests a judgement, and a model may well pick a fix itself, so the case would measure the model's taste more than the path; the limit is the documented, deterministic trigger and reaches the same branch (no part, `Status: too-large`, `/bdk:design`). A fixture whose fix truly spans more than 10 files would cost a large new fixture for the same branch.

### D2. `debug-resume-review` starts from the recorded run of `diagnose-run.sh`

The scaffold builds `diagnose-run.sh` (a real `debug-fix` run: diagnosis, auto gate, the Change and the fix committed on `fix-total-crash`, `execute/result.md` `Status: done`) and removes what the review wrote (`review/`, `checks/round-1*`, `debug/result.md`) and the transcripts. `/bdk:debug` step 2 then lands on row 6 ("no `R/review/result.md`"). The graders: `auto-review` follows `/bdk:debug`, no `diagnose-bug` or `execute` Skill call, `review/result.md` created, `debug/result.md` written from the files (its `## Fix` carries the part report's `red seen; green seen` line), the branch kept.

Alternatives: a new fixture written by hand for that state. The recorded run is real output of the skills, already kept current with them (#322), so it cannot drift from what `execute` writes; a hand-written copy can. `commit` is left out of the "no earlier stage" grader: the review's fix pass may commit inside its lead, and the grader would read a nested call as the orchestrator's.

### D3. `bdk check run` says when the tail is cut

In text mode, under a red check whose tail is 20 lines (`TAIL_LINES`, so the output may be longer), the command prints one more indented line after the tail: `(last 20 lines; the whole output is in the file above)`. A shorter tail is the whole output and gets no line. The JSON result is unchanged (spec `bdk-cli/check`, "Check run result" stays byte-identical).

Alternatives:
- Only the skill text. Step 4 already says to read the output file and the implementer skipped it; the printed tail looks like the whole story at the moment the model decides. The note sits where the decision is made, for every caller (`implement-part`, `conform-part`, `resolve-conflict`, `review-round`).
- A longer tail. Any fixed length is too short for some suite, and a long tail floods every red result.
- A `lines` count in the JSON, to print "last 20 of 57". It changes the persisted result for a wording gain; the note is true without it.

This is a CLI helper for a problem a measurement showed (CLAUDE.md, "Building skills (v3)"): run 2 above.

### D4. `implement-part` reads each acceptance test's own failure, and its report line has one form

Step 4: the lines printed under a red check are its last 20 only; when they do not show every acceptance test failing (the note of D3 says they are cut), read the output file and find each test's own failure there; a test whose failure was not seen is not seen red. Step 7: each acceptance test line ends with exactly `; red seen; green seen`; anything to add goes under `## Decisions taken without the user`. A test whose red was not seen is run red again, not reported as seen. Changed with `/skill-creator`.

Alternative: relaxing the grader to accept a note. The note in run 2 records that the red was not seen; accepting it would let an unseen red pass the acceptance signal.

### D5. Graders check every acceptance line

`debug-fix/graders/test-red-then-green.md` and `implement-part-csv/graders/red-then-green.md` require every line under `## Acceptance tests` to end with `; red seen; green seen`, up to `## Changed files`. A grader that the implementer always reads the red output file was tried on `implement-part-csv` and dropped: there the test file fails to load (`ERR_MODULE_NOT_FOUND`, `tests 1`), the printed lines show the one failure that covers all four tests, and reading the file adds nothing. The skill asks for the file only when the printed lines do not show every test failing; `debug-fix` with the stricter grader is the case where they do not (run 2).

`diagnose-bug-not-reproduced/graders/not-reproduced.md` read the trace for a `Write` of `diagnosis.md` only; in two of three final runs the block wrote the file with a Bash heredoc (`cat > .../diagnosis.md <<'EOF'`), with the right content, and the grader missed it. The pattern now takes either form. A file grader is not possible there: the prompt names no Change, so the run directory's name is the block's own.

### D6. A block's reply does not end `/bdk:debug`

The second round of runs (after D3 to D5) showed one `debug-fix` run and one `debug-manual-gate` run end the turn right after `diagnose-bug`'s own step 7 reply ("Status: ready ... Next: /bdk:debug fix-total-crash"), with no gate, commit or build. `diagnose-bug` writes that reply for a user who ran it alone. `/bdk:debug` gets the paragraph `/bdk:run` already has for its stages ("A stage's end is not the run's end"): the reply of `diagnose-bug` or `commit` ends the block only; go on in the same turn and stop only where this skill says to. Step 3 says it again at the point of reading `diagnosis.md`.

Alternatives: make `diagnose-bug` reply differently when invoked by `/bdk:debug`. A block would then depend on who called it, against "each block runs alone" (CLAUDE.md, "Building skills (v3)"); the orchestrator owns the composition.

### D7. A reported symptom goes to `/bdk:debug` even when the fix is one line

In two runs of the same round (`debug-manual-gate`, `debug-too-large`) the main session never invoked `/bdk:debug`: it read `bin/tally.js`, saw the one-line cause, edited it directly and said so ("a one-line fix, which BDK handles without a Change"), without a test. It followed the session start context (v3-285 D2: "A small edit you can see whole (a typo, a version bump, a one-line fix) is done directly"). v3-285 D2 meant a fix seen whole from the request, and routes "a reported bug that needs diagnosis" to `/bdk:debug`; a crash report names a symptom, and finding its cause is the diagnosis. The description of `/bdk:debug` now says so where the session picks a skill: also when the fix may turn out to be one line, a reported symptom is diagnosed and fixed with a test, not edited directly.

Alternatives: reword the session start lines. They are a user-approved decision of v3-285 (D2) and say the same when read as meant; the description is where the routing is decided, and changing it keeps that decision closed. If runs still route a symptom past `/bdk:debug`, the session text is the next place, in its own issue.

### D8. The `debug-fix` reply rubric accepts a named blocker

In the third round one `debug-fix` run ended `Status: blocked`: the review's fix part added a test for the "Empty ledger" scenario, which already passed, so `implement-part` could not see it red and blocked (#346). The reply named the blocker and `/bdk:auto-review fix-total-crash`, which the rubric allowed ("or, when the review left a blocker, names that blocker with its command"), yet the judge failed it three times. The rubric now spells the blocked branch out in its PASS line and says that a blocked review with its blocker and command named passes; the FAIL line names what is really missing.

Alternatives: keep the rubric and count the run as a miss. The reply did what the skill asks on a blocked run; the miss was the judge's reading of a rubric whose PASS line covered only the happy path. The blocker itself is a real gap, tracked in #346, outside this Change.

### D9. The fix part's only acceptance scenario is the reproduction

The fourth round showed the `test-red-then-green` miss a second way. `diagnose-bug` wrote a part with two acceptance scenarios, the reproduction and the main spec's "Empty ledger" (which passes today), and a task to "pin the empty ledger case with a test". The implementer could not see that test red, wrote `green seen only, see Decisions` and still reported `Status: done`; the grader of D5 failed it. The spec already says the part's acceptance scenario is the reproduction scenario (`bdk-debug`, "Fix Change"); the skill text did not say "only", nor why. It now does: the only acceptance scenario is the reproduction, and no task only pins behaviour that already works, since its test cannot fail. `diagnose-bug-reproduced` gets the grader `one-acceptance-scenario`.

Alternatives: let `implement-part` accept a guard test that passes at once. That is the general question of #346 (a review fix part that adds a test for present behaviour), which needs its own decision on who marks such a test; for a fix Change the guard is not needed at all, since the review round's E2E check and the existing suite cover the rest of the spec.

## Risks / Trade-offs

- [A model ignores the note too] -> the stricter graders fail the run, so the suite shows it; the skill line of D4 says the same at the point of writing the report.
- [`debug-resume-review` depends on the recorded run of `diagnose-run.sh`] -> a new recording (eval README, "To record a new fixture run") keeps the same state; the scaffold removes only the review's files.
- [`max-files: 1` is not a real project's setting] -> the case tests the branch, not the threshold; the threshold itself is covered by `bdk plan check` tests.

## Measurements

Recorded 2026-10-09 with `claude plugin eval` (Claude Code 2.1.292), `--ablation none`, clean `HOME` and the git shell prefix of the eval README's "Host limits", on the final skill texts:

| Case | Score | Runs | Cost |
|---|---|---|---|
| `debug-too-large` | 1.00 | 3/3 | $0.87 |
| `debug-resume-review` | 1.00 | 3/3 | $2.80 |
| `debug-fix` | 1.00 | 3/3 (strict `test-red-then-green` of D5) | $5.61 |
| `debug-manual-gate` | 1.00 | 3/3 | $1.16 |
| `diagnose-bug-reproduced` | 1.00 | 3/3 (with `one-acceptance-scenario` of D9) | $0.90 |

The four `debug-*` cases took 420 s together at `-j 4` ($10.44). `diagnose-bug-not-reproduced` scored 0.87 in the same round only because of the heredoc write its old grader missed (D5); the new pattern matches all three kept traces.

The rounds before the final one, each on the texts of its time: round 1 (`debug-fix` x3, before any change) 1.00, 1.00 and 0.18 (#341); round 2 (all `debug-*`, after D3 to D5) `debug-fix` 0.73, `debug-manual-gate` 0.75, `debug-too-large` 0.78, `debug-resume-review` 1.00, with the misses of D6 and D7; round 3 (after D6, D7) every case 1.00 but `debug-fix` 0.97 (D8, #346); round 4 (`debug-fix` x3) 0.97, the miss of D9. `implement-part-csv` routed to `/bdk:execute` in 4 of 6 runs (#343); in every run where a part report was written, its four acceptance lines ended `; red seen; green seen`.

## Migration Plan

None.

## Open Questions

None. Found on the way and left to their own issues: the `openspec` hang of run 3 (#341), `implement part 01` routed to `/bdk:execute` in one `implement-part-csv` run (#343), and a fix part that only adds a test for present behaviour blocking `implement-part` (#346).

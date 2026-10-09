## 1. Eval cases of the uncovered debug scenarios

- [x] 1.1 Add `plugins/bdk/evals/debug-too-large/` (D1): scaffold on `tally-bug.sh` with `plan.part.max-files: 1` and the auto design gate; graders for `Status: too-large` with `Next: /bdk:design fix-total-crash`, the proposal and `design.md`, no plan part, no `gate.md`, no `commit`/`execute`/`auto-review` Skill call, `bin/tally.js` unchanged, and the reply
- [x] 1.2 Add `plugins/bdk/evals/debug-resume-review/` (D2): scaffold on `diagnose-run.sh` without the review's files; graders for `auto-review` after `/bdk:debug`, no `diagnose-bug` or `execute` Skill call, `review/result.md`, `debug/result.md` with the acceptance line under `## Fix`, the branch kept, and the reply
- [x] 1.3 `pnpm check` loads both cases (the free eval check)

## 2. Graders that catch the miss

- [x] 2.1 `debug-fix/graders/test-red-then-green.md` and `implement-part-csv/graders/red-then-green.md`: every acceptance line ends `; red seen; green seen` (D5); check the pattern against the kept report of run 2 (must fail) and run 1 (must pass)
- [x] 2.2 Try a grader on `implement-part-csv` that the red output file is read; drop it if the printed lines suffice there (D5)
- [x] 2.3 `debug-fix/graders/reply.md`: a blocked run that names its blocker and a command passes (D8)
- [x] 2.4 `diagnose-bug-not-reproduced/graders/not-reproduced.md`: also a Bash heredoc write of `diagnosis.md` (D5)

## 3. Cut tail note in `bdk check run`

- [x] 3.1 Test first in `plugins/bdk/src/check/tests/use-cases.test.ts`: a red check with a 20-line tail renders the note line after its tail, one with a shorter tail does not; run it and see it fail
- [x] 3.2 Render the note in `plugins/bdk/src/check/render/run.ts` (D3); the test passes

## 4. implement-part (with /skill-creator)

- [x] 4.1 Step 4: find each acceptance test's own failure in the output file, not only in the printed tail; `red seen` only for a failure read there (D4)
- [x] 4.2 Step 7: each acceptance line ends exactly `; red seen; green seen`; a remark goes under `Decisions taken without the user` (D4)
- [x] 4.3 `skill-check` passes (`pnpm check`)

## 5. /bdk:debug composition and routing (with /skill-creator)

- [x] 5.1 The cases `debug-fix`, `debug-manual-gate` and `debug-too-large` already grade the Skill calls after `diagnose-bug` and that the skill fired (the eval step for D6 and D7)
- [x] 5.2 `skills/debug/SKILL.md`: "A block's end is not the run's end" and step 3 goes on in the same turn (D6)
- [x] 5.3 `skills/debug/SKILL.md` description: a reported symptom routes here also when the fix may be one line (D7)

- [x] 5.4 `diagnose-bug-reproduced/graders/one-acceptance-scenario.md` (D9): checked against the kept part of the failing run (no match) and the recorded `diagnose-run` part (match)
- [x] 5.5 `skills/diagnose-bug/SKILL.md`: the reproduction is the only acceptance scenario, no task only pins behaviour that already works (D9)

## 6. Docs

- [x] 6.1 `docs/concepts/orchestrators.md`, "Where execute runs your checks", the `NN-red` row: each test's own failure is read in the output file; the printed tail is the last 20 lines
- [x] 6.2 `docs/guide/workflow.md`, "A bug": a reported symptom goes to `/bdk:debug` even when the fix is one line
- [x] 6.3 Run `pnpm docs:reference` and commit the regenerated `docs/reference/`
- [x] 6.4 `plugins/bdk/evals/README.md`: the two new cases, the grants, and the measured scores

## 7. Acceptance and gates

- [x] 7.1 `debug-too-large` and `debug-resume-review` pass 3/3 with the plugin
- [x] 7.2 `debug-fix` over 3 runs with the stricter grader, `diagnose-bug-*` and `implement-part-csv` over 3 runs; record the scores in design.md "Measurements"
- [x] 7.3 Every check CI runs (`.github/workflows/`), `openspec validate v3-262-debug-evals --strict` and `openspec validate --specs --strict`

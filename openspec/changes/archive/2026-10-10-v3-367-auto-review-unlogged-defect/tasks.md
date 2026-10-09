## 1. Eval cases

- [x] 1.1 Add the block case `plugins/bdk/evals/review-integration-outside-fix-scope/` (scaffold: round 1 triaged, fix part 03 committed to `src/parse.test.js`, round 2 recorded with an empty log; graders: seam finding outside the fix scope, no repeat of the accepted parse bug, no edit, skill fired) and run it against the current skill
- [x] 1.2 Add the `result-agrees` grader to `plugins/bdk/evals/auto-review-test-only-fix/graders/`
- [x] 1.3 Name the new case and grader with their commands in `plugins/bdk/evals/README.md`

## 2. Skills (with /skill-creator)

- [x] 2.1 `skills/review-integration/SKILL.md`: in a fix round read every earlier round's log, log a defect seen outside the fix scope with evidence saying so, never repeat an earlier round's finding, return only logged findings
- [x] 2.2 `skills/auto-review/SKILL.md`: the stage result comes from the round files only; read no project source file outside the invoked skills; a worker's reply or code read in the main session never changes the status nor appears in the result or reply
- [x] 2.3 Run `review-integration-outside-fix-scope` (both arms), `review-integration-seam` and `auto-review-test-only-fix` (3 runs) against the new skills and record the results in `plugins/bdk/evals/README.md`

## 3. Docs

- [x] 3.1 `docs/concepts/findings.md` (a defect seen outside a fix round's scope becomes a finding) and `docs/concepts/orchestrators.md` (the integration reviewer in a later round; the stage result comes from the round files); no diagram changes
- [x] 3.2 Run `pnpm docs:reference`

## 4. Gates

- [x] 4.1 Check the acceptance signal: `auto-review-test-only-fix` scores 1.00 in 3 of 3 runs and its `review/result.md` agrees with the round files
- [x] 4.2 `pnpm check`, every check in `.github/workflows/`, `openspec validate v3-367-auto-review-unlogged-defect --strict` and `openspec validate --specs --strict`

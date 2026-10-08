# Tasks

## 1. Eval cases first

- [x] 1.1 Case `plan-fixes-judged-round` (block): scaffold on `monthly-report-judged.sh` with decisions recorded (blocker and should-fix `fix`, nice-to-have `defer`, not-a-problem `accept`), prompt and graders per design D9
- [x] 1.2 Case `triage-last-round` (block): scaffold with `policy.gates.review: auto`, prompt naming `--last-round`, graders per spec `triage-block` "Last round of the budget"
- [x] 1.3 Cases `auto-review-first-round` and `auto-review-fix-round` (orchestrator): scaffolds (git identity; auto gate and budget 2 for the fix case), prompts and graders per design D9
- [x] 1.4 Free check green: `pnpm exec vitest run plugins/bdk/tests/evals.test.ts`

## 2. Changed blocks (with /skill-creator)

- [x] 2.1 `implement-part`, `conform-part`, `resolve-conflict`: `--parts <dir>`; verified by `skill-check` and a read of the argument lines
- [x] 2.2 `execute-waves`: `--parts <dir>` with its own `state.json` and `result.md`, passed on to every worker
- [x] 2.3 `review-group` and `review-integration`: fix-part lookup, fixed findings checked again, fix-scope integration in a round anchored on a round
- [x] 2.4 `triage`: `--last-round`; try `triage-last-round` in a scratch project with `claude -p --plugin-dir plugins/bdk`

## 3. New blocks and lead skill (with /skill-creator)

- [x] 3.1 Block `skills/plan-fixes/SKILL.md`; try it in a scratch project built from `plan-fixes-judged-round`
- [x] 3.2 Lead skill `skills/review-round/SKILL.md`; `agents/lead.md` names it
- [x] 3.3 Orchestrator `skills/auto-review/SKILL.md`
- [x] 3.4 Try `/bdk:auto-review` in scratch projects built from both orchestrator scaffolds with `claude -p --plugin-dir plugins/bdk`; fix what the runs show

## 4. Documentation

- [x] 4.1 `plugins/bdk/evals/README.md`: the review stage cases, grants and run commands
- [x] 4.2 `CLAUDE.md` "Current state"

## 5. Acceptance and gates

- [x] 5.1 Run the four eval cases with `claude plugin eval` (block cases both arms, orchestrator cases one arm); record the results in design.md "Measurements"; the acceptance signal: `auto-review-fix-round` passes and its round 2 covers only the fix scope
- [x] 5.2 Every check CI runs (`pnpm check` and the other jobs of `.github/workflows/`), `openspec validate v3-201-auto-review-round --strict`, `openspec validate --specs --strict`

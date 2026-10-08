# Tasks

## 1. Eval cases first

- [x] 1.1 Shared fixture `evals/fixtures/tally-bug.sh`: configured tally CLI on the BDK schema with main spec `tally`, a `cli` e2e item, a passing test, a local git identity, and the seeded bug (`add` stores the amount as text, so `total` crashes)
- [x] 1.2 Block cases `diagnose-bug-reproduced` and `diagnose-bug-not-reproduced`: scaffolds, prompts and graders per design D9
- [x] 1.3 Orchestrator cases `debug-fix` (auto gates, foreground lead) and `debug-manual-gate`: scaffolds, prompts and graders per design D9
- [x] 1.4 Free check green: `pnpm exec vitest run plugins/bdk/tests/evals.test.ts`

## 2. Block `diagnose-bug` (with /skill-creator)

- [x] 2.1 `skills/diagnose-bug/SKILL.md`: report, reproduction first, root cause, fix Change, `bdk plan check`, `debug/diagnosis.md`; `skill-check` clean
- [x] 2.2 Try it in a scratch project built from `diagnose-bug-reproduced` and `diagnose-bug-not-reproduced` with `claude -p --plugin-dir plugins/bdk`; fix what the runs show

## 3. Orchestrator `/bdk:debug` (with /skill-creator)

- [x] 3.1 `skills/debug/SKILL.md`: start checks, resume table, gate, branch and commit, execute, auto-review, `debug/result.md`; `skill-check` clean
- [x] 3.2 Try `/bdk:debug` in scratch projects built from `debug-fix` and `debug-manual-gate`; fix what the runs show

## 4. Documentation

- [x] 4.1 `plugins/bdk/evals/README.md`: the debug cases, grants and run commands
- [x] 4.2 `CLAUDE.md` "Current state"

## 5. Acceptance and gates

- [x] 5.1 Run the eval cases with `claude plugin eval` (block cases both arms, orchestrator cases one arm); record the results in design.md "Measurements"; the acceptance signal: `debug-fix` passes (reproduction test red then green, product fixed)
- [x] 5.2 Every check CI runs (`pnpm check` and the other jobs of `.github/workflows/`), `openspec validate v3-204-bdk-debug --strict`, `openspec validate --specs --strict`

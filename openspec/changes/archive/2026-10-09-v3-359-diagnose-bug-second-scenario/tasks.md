# Tasks

## 1. Eval case first

- [x] 1.1 Add `plugins/bdk/evals/diagnose-bug-related-defect/` (case.yaml, prompt.md, scaffold.sh on `fixtures/tally-bug.sh`, graders per design D4); verify `pnpm exec vitest run plugins/bdk/tests/evals.test.ts` passes
- [x] 1.2 Baseline: run `diagnose-bug-related-defect` with the current skill (`--ablation none`, 3 runs) and record the scores in design "Measurement"

## 2. Skill text (with /skill-creator)

- [x] 2.1 `plugins/bdk/skills/diagnose-bug/SKILL.md`: related defects named, not fixed (design D1, D2): step 3, step 5 (design.md Risks, part rule), step 6 (`Related:` line), step 7 (reply); verify with a /skill-creator review
- [x] 2.2 `plugins/bdk/skills/debug/SKILL.md`: the gate names `Related:` lines, `debug/result.md` lists them under `## Bug` (design D3)

## 3. Measurement

- [x] 3.1 Run `diagnose-bug-related-defect` 9 times and `diagnose-bug-reproduced` 9 times at `-j 3` with the plugin; record the scores in design "Measurement"; both pass `one-acceptance-scenario` in 9 of 9

## 4. Docs

- [x] 4.1 `docs/concepts/orchestrators.md`, section `/bdk:debug`: prose on related defects and the diagram's diagnose box (`Related:` lines named, not fixed); `docs/guide/workflow.md` bug entry; `plugins/bdk/evals/README.md` names the new case if it lists debug cases
- [x] 4.2 Run `pnpm docs:reference`

## 5. Acceptance and gates

- [x] 5.1 Acceptance signal: `diagnose-bug-reproduced` passes `one-acceptance-scenario` in 9 of 9 runs (task 3.1)
- [x] 5.2 Run every CI check (`.github/workflows/`), `openspec validate v3-359-diagnose-bug-second-scenario --strict` and `openspec validate --specs --strict`

# Tasks

## 1. Grader rule

- [x] 1.1 Write the failing checks in `plugins/bdk/tests/evals.test.ts`: an orchestrator case holds `tool_order`; it holds `file_exists` unless tagged `writes-nothing`, and then a trace `regex` and no `file_exists` (design D3)
- [x] 1.2 Make them pass against the existing cases and record the rule in `plugins/bdk/evals/README.md`, "Write a case"

## 2. Cases

- [x] 2.1 Write the case `plugins/bdk/evals/plan-design-gap/` (scaffold, prompt, graders; design D1)
- [x] 2.2 Write the case `plugins/bdk/evals/plan-passed/` with its passing report (design D2)
- [x] 2.3 Run `evals.test.ts`: both cases load, their scaffolds build, the grader rule holds

## 3. Measurement

- [x] 3.1 Run both cases with `--ablation none --runs 1` in a plain terminal pane, and the gap case three times (design D4)
- [x] 3.2 Record the results in design "Results" and in `plugins/bdk/evals/README.md`

## 4. plan-draft gap rule

- [x] 4.1 Sharpen the gap paragraph of step 2 and the gap line of step 7 of `plugins/bdk/skills/plan-draft/SKILL.md` with `/skill-creator` (design D5); the failing case is `plan-design-gap` (task 3.1)
- [x] 4.2 Run `plan-design-gap` three times and every `plan-*` orchestrator case once, and record the results

## 5. Docs

- [x] 5.1 `docs/concepts/orchestrators.md`, `/bdk:plan`: what counts as a gap of the design; check `docs/concepts/stages.md` (`/bdk:plan-draft` row) still holds; run `pnpm docs:reference`

## 6. Gates

- [x] 6.1 Run every CI check (`.github/workflows/`), `openspec validate v3-249-plan-gap-evals --strict` and `openspec validate --specs --strict`

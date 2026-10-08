# Tasks

## 1. Case

- [x] 1.1 Write the failing free check of the gap variant in `plugins/bdk/tests/household-book.test.ts` (design D2; spec scenarios "Scaffold opens the short-month choice", "Everything else is the shared fixture")
- [x] 1.2 Write the case `plugins/bdk/evals/plan-draft-household-book-gap/` (scaffold, prompt, graders; design D1-D3) and run `household-book.test.ts` and `evals.test.ts`

## 2. Measurement

- [x] 2.1 Run the case with and without the plugin, 3 runs per arm, `--model sonnet`, `--keep-temp` (design D4)
- [x] 2.2 Measure every run on its kept workspace: named, decided, held, parts, `bdk plan check` (design D4)
- [x] 2.3 Record the results in design "Measurement" and the decision by D5 in design "Decision"

## 3. Decision

- [x] 3.1 Apply the decision: when "change", rewrite step 2 of `plan-draft` with `/skill-creator` and run the with-arm again; when "remove", remove the gap paragraph and the gap line of step 7 with `/skill-creator`; when "keep", record it in the README paragraph of the case

## 4. Documentation and gates

- [x] 4.1 Document the case, its run command and the recorded result in `plugins/bdk/evals/README.md`
- [x] 4.2 Check the acceptance signal (a recorded with/without result and a decision), then run every CI check (`.github/workflows/`), `openspec validate v3-253-measure-plan-draft-gap --strict` and `openspec validate --specs --strict`

# Tasks

## 1. Eval case

- [x] 1.1 Move the AC part of `fixtures/ledger-acceptance.sh` to `fixtures/ledger-acceptance/criteria.sh` and call it from the fixture; `tests/evals.test.ts` still builds every fixture alone
- [x] 1.2 Add the block case `design-draft-acceptance` (`ledger-explored.sh` + the criteria, `policy.questions: decide-and-record`) with graders for AC-1 to AC-4, reuse of `listEntries` and `formatCents`, and no `needs-user` entry; check that its scaffold builds

## 2. Measurement

- [x] 2.1 State the measure and the decision rule before the runs (design D4)
- [x] 2.2 Run `design-draft-acceptance` and `plan-draft-household-book` on `sonnet` and `opus`, `--runs 1 --ablation none --keep-temp`, and verify each plan with one `/bdk:verify-plan` round
- [x] 2.3 Repeat `design-draft-acceptance` once per model, as the first pair moved a default
- [x] 2.4 Add the grader `ac3-not-narrowed` for the AC-3 narrowing the runs showed
- [x] 2.5 Record the results, the cost per agent and the total cost in design "Measurement" and in `plugins/bdk/evals/README.md`
- [x] 2.6 File the out-of-scope defects the runs showed: #426 (`verify-design` passes a narrowed AC), #427 (`plan-draft` `Verified by:` ending)

## 3. Defaults

- [x] 3.1 `plugins/bdk/agents/designer.md`: `model: opus` (D5); `planner.md` stays on `inherit` (D6)
- [x] 3.2 Spec delta `design-blocks`: "Designer agent on opus" replaces "Designer agent"; the eval case requirement names `design-draft-acceptance`

## 4. Docs

- [x] 4.1 `docs/guide/footprint.md` (models row), `docs/guide/configuration.md` ("Choose models"), `docs/concepts/agents.md` (the agents diagram and the blocks table), `docs/design/2026-10-07-v3-architecture.md` (table of blocks)
- [x] 4.2 Regenerate the Reference with `pnpm docs:reference`

## 5. Gates

- [x] 5.1 Sync the main specs, `openspec validate --specs --strict`, `pnpm check`

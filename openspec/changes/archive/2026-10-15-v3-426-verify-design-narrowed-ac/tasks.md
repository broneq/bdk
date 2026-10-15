## 1. Eval case

- [x] 1.1 Add the block case `plugins/bdk/evals/verify-design-narrowed-ac/` (scaffold on `ledger-designed.sh` and `ledger-acceptance/criteria.sh`, a delta that quotes only the delimiter in use, graders `verdict-fail` and `names-ac-3`)

## 2. Skill

- [x] 2.1 With /skill-creator, rewrite step 3.10 of `plugins/bdk/skills/verify-design/SKILL.md` to check each AC under every option the deltas bring in, with one `Checked` line per AC, and name a narrowing under one option in step 4
- [x] 2.2 Run `verify-design-narrowed-ac` 3 times (`--ablation none`) and `verify-design-dropped-ac-user` once; record the result and cost in design "Measurement" and `plugins/bdk/evals/README.md`

## 3. Docs

- [x] 3.1 `docs/concepts/stages.md`: why a design fails verification names an AC narrowed under one option; no diagram changes
- [x] 3.2 Run `pnpm docs:reference`

## 4. Checks

- [x] 4.1 Acceptance signal: the 3 runs of 2.2 give `Verdict: FAIL` naming AC-3 under `Must address`
- [x] 4.2 `pnpm check`, the other checks of `.github/workflows/`, `openspec validate v3-426-verify-design-narrowed-ac --strict` and `openspec validate --specs --strict`

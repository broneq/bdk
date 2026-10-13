# Tasks

## 1. Eval cases first

- [x] 1.1 Add `plugins/bdk/evals/design-draft-page-contract/` (block): `ledger-explored.sh` with the `lavish-axi` stub of `design-draft-lavish`, a Polish prompt, graders that the page is written and opened, that it carries the three `data-bdk-section` markers, and an `llm` grader on `.lavish/design-add-csv-export.html` that every card holds the three sections with a `file:line` and is in Polish. Verify: `pnpm check` (eval case layout) passes.
- [x] 1.2 Add `plugins/bdk/evals/design-draft-page-resume-bare/` (block): `ledger-explored.sh`, the stub, and a bare round-1 page `.lavish/design-add-csv-export.html` (two cards, question and radios only); graders that a Write or Edit of that page comes before the Bash call that opens it, and an `llm` grader on the final page. Verify: `pnpm check` passes.
- [x] 1.3 Probe both cases on the current skill (`--runs 1 --ablation none --model sonnet --max-cost-usd 4` each) and record the scores and cost: they are expected to fail the contract graders.

## 2. Skill

- [x] 2.1 With `/skill-creator`, add `plugins/bdk/skills/design-draft/references/question-page.md` (card contract, markers, language, check before opening) and change `design-draft/SKILL.md` step 0.1 and step 4 (point to the reference, check before every open including the resume, language of the page and of listed questions). Verify: `bdk-skill-kit:skill-check` on the skill passes.
- [x] 2.2 Change `plugins/bdk/skills/design/SKILL.md` "The blocks": the designer's prompt names the user's language. Verify: `bdk-skill-kit:skill-check` passes.
- [x] 2.3 Try `/bdk:design-draft` in a separate test project with the plugin loaded (the eval runs of 1.3 and 4.1 load `plugins/bdk` into a scaffolded ledger workspace), and check the page by eye (a headless Chrome screenshot of the Polish page).

## 3. Docs

- [x] 3.1 Update `docs/concepts/orchestrators.md` (design questions: what a card holds, its language) and the `/bdk:design-draft` row of `docs/concepts/stages.md`; no diagram changes (no step, exit, command, settings key, file or agent of a flow changes). Run `pnpm docs:reference`.
- [x] 3.2 Add the two cases to the design-block part of `plugins/bdk/evals/README.md`.

## 4. Acceptance and gates

- [x] 4.1 Run `design-draft-page-contract`, `design-draft-page-resume-bare` and the regression `design-draft-lavish` with the plugin (`--runs 1 --ablation none --model sonnet`, `--max-cost-usd` set, within the issue's $15 Budget) and record the scores, cost and machine time of every paid run in design "Measurement".
- [x] 4.2 Run every check CI runs (`.github/workflows/`), `openspec validate v3-409-question-page-contract --strict` and `openspec validate --specs --strict`.

# Tasks

## 1. Fixture and eval cases first

- [x] 1.1 Write the shared fixture `plugins/bdk/evals/fixtures/ledger-change.sh` (design D11): `tiny-ledger`, `.bdk/settings.yaml`, `openspec/` with the BDK schema copied from the plugin, Change `add-csv-export` with proposal, spec delta (six scenarios) and design, one commit; verify by running it in an empty directory and `bdk plan check` / `openspec status --change add-csv-export` there
- [x] 1.2 Write the case directories `plan-draft-csv-export`, `verify-plan-defects` (three planted defects that pass `bdk plan check`), `verify-plan-sound` (prompt, `case.yaml`, `scaffold.sh`, graders per design D11); verify the planted plans with `bdk plan check` (exit 0 for both)
- [x] 1.3 Run the free check (`pnpm exec vitest run plugins/bdk/tests/evals.test.ts`) and see it load the new cases and run their scaffolds

## 2. The verifier agent and the template

- [x] 2.1 Write `plugins/bdk/agents/verifier.md` (design D1-D3, spec `bdk-verifier`); `claude plugin validate plugins/bdk --strict` passes
- [x] 2.2 Show the D1 task lines in `plugins/bdk/openspec/schemas/bdk/templates/part.md` and the `plan` instruction of `schema.yaml` (design D10); the schema tests and `openspec schema validate` still pass

## 3. The skills

- [x] 3.1 Build `plugins/bdk/skills/plan-draft/SKILL.md` with `/skill-creator` (design D5-D8), with `references/part-example.md`
- [x] 3.2 Build `plugins/bdk/skills/verify-plan/SKILL.md` with `/skill-creator` (design D2-D4)
- [x] 3.3 Run `bdk-skill-kit:skill-check` on both skills and the agent and fix every finding
- [x] 3.4 Add the plan cases, their grants and run command to `plugins/bdk/evals/README.md`

## 4. Acceptance end to end

- [x] 4.1 Build the plugin; in a project scaffolded from `ledger-change.sh` outside this repository, run `claude -p "/bdk:plan-draft add-csv-export" --plugin-dir plugins/bdk`; check the parts exist, `bdk plan check` exits 0, every scenario is owned once, every task has the D1 lines
- [x] 4.2 In projects scaffolded from the two verify cases, run `claude -p "/bdk:verify-plan add-csv-export" --plugin-dir plugins/bdk`; check the report path, the verdict, the three defects in `Must address`, and that no plan file changed; then run `/bdk:plan-draft` on the failed one and check it fixes the `Must address` items
- [x] 4.3 Run the eval cases with and without the plugin and record the results in design "Eval results" (acceptance signal of #191)
- [x] 4.4 Run every CI check (`pnpm check`, `claude plugin validate` of the marketplace and every plugin), `openspec validate v3-191-plan-blocks --strict` and `openspec validate --specs --strict`

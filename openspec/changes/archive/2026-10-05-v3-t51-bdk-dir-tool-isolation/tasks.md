# Tasks

## 1. Tests first

- [x] 1.1 In `kernel/tests/contract/stage-skills.test.ts`, add a `describe` for the `setup` isolation requirement (the skill text scenario). In `kernel/tests/contract/role-contracts.test.ts`, add one for the "line in each contract" scenario. Run both and see them fail.
- [x] 1.2 Write the point-4 E2E test `kernel/src/spec/tests/formatter.e2e.ts` with the two `kernel-state` scenarios: the pinned prettier over a reviewed Change with a merged living spec, with and without `.bdk/` in `.prettierignore`. Run it: the first case passes against the current kernel (it records D3), the second passes too, since the protection is the project's own ignore list.

## 2. setup

- [x] 2.1 Add the ignore column to `skills/stages/setup/references/stacks.md`: a table of known tools that read Markdown, YAML or JSON (or Python, for ruff), where each reads its ignore list and the entry to add, plus the row for a project script that lists files itself.
- [x] 2.2 Add the section "Keep `.bdk/` out of the project's tools" to `skills/stages/setup/SKILL.md` between "Settings" and "Lavish" (D1); extend `allowed-tools` with `Edit`, `Write`, `Bash(git add *)`, `Bash(git commit *)`; narrow the Constraints line to keep "never edit `.bdk/` files" and allow the tool-config edit; name a declined exclusion in "Finish".

## 3. Role contracts

- [x] 3.1 Add the D4 line to `implementer`, `simplifier`, `runner`, `reviewer` and `integration-reviewer`, trimming repeated wording where the 4 096-byte budget needs it.

## 4. Evals and docs

- [x] 4.1 `evals/suites/stages/cases/setup.yaml`: the `fresh-project` case answers the exclusion question and expects the commit (D5). `evals/suites/stages/cases/run.yaml`: `run-auto` prepares the fixture as setup leaves it, uses `npm run lint` and expects no commit touching the tool configuration. Run `pnpm eval check`.
- [x] 4.2 Update `docs/guide/getting-started/setup.md` and `docs/guide/troubleshooting.md`; run `pnpm docs:build`.
- [x] 4.3 With the user's approval of the spend only, run the `setup` `fresh-project` and the `run-auto` stage cases with `pnpm eval`. Without approval, leave this box open and report it.

## 5. Acceptance

- [x] 5.1 Run the new and touched tests: `stage-skills`, `role-contracts`, `formatter.e2e.ts`. All pass.
- [x] 5.2 Run the gate: `pnpm build`, `lint`, `format:check`, `typecheck`, `knip`, `test:unit`, `test:e2e`, `test:contract`, `skill-check`, `docs:build`, `eval check`.
- [x] 5.3 Run `openspec validate v3-t51-bdk-dir-tool-isolation --strict`.

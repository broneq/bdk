# Tasks

## 1. Layout and checks (D1)

- [x] 1.1 Failing contract test: skills are discovered from `skills/` and every entry of the manifest's `skills` array, so a skill under `skills/stages/` is subject to the context-line and manifest checks of `skill-context.test.ts`
- [x] 1.2 Read the skill directories from `.claude-plugin/plugin.json` in the contract tests and in `skill-check.config.ts` (targets) instead of hard-coded lists; add `./skills/stages/` to the manifest
- [x] 1.3 Failing check: `pnpm skill-check` reports `setup` and `change` without `disable-model-invocation: true` (seeded fixture or kit test run)
- [x] 1.4 Add `setup` and `change` to the `required-fields` gate entry of `skill-check.config.ts`; sync the `skill-content-checks` main spec with the delta

## 2. `setup` (D2, D3, D4, D5)

- [x] 2.1 Probe in a scratch repository: every `config set` form the skill uses (`languages`, each tool group entry by `id`, `features.lavish`), `bdk rules import --dry-run`; record any kernel gap as a `kernel-cli/<group>` delta before writing prose around it
- [x] 2.6 Remove the `bdk import` stub (decision 4): `schema/cli/commands.json`, `schema/cli/output/import.json`, `doctor` / `config check` / session-start repair text, the specs that name it, T32 in the plan
- [x] 2.2 `ctx skill setup` manifest entry (three tool groups); failing contract test first via the manifest/skill set equality
- [x] 2.3 `skills/stages/setup/references/stacks.md` (detection and scoped-form tables from the v2 skill, adapted to `config set` entries) and `references/v2-migration.md` (D10)
- [x] 2.4 `skills/stages/setup/SKILL.md` per `specs/stage-skills` (setup requirements) and `.claude/rules/prompt-writing.md`; delete `skills/setup/`; `pnpm skill-check --baseline-prune`
- [x] 2.5 Review the skill with `/bdk-skill-kit:skill-authoring`; `pnpm skill-check` green

## 3. `change` (D5, D6, D7)

- [x] 3.1 `ctx skill change` manifest entry (no part, or the `decision` fragment if an empty entry is rejected); failing contract test first
- [x] 3.2 `skills/stages/change/SKILL.md` per `specs/stage-skills` (change requirements): argument mapping, branch question, `tiny` checklist, `--kind bug`, closing render
- [x] 3.3 Review with `/bdk-skill-kit:skill-authoring`; `pnpm skill-check` green

## 4. `stages` eval suite (D8)

- [x] 4.1 Failing harness unit tests: case file parsing (base, setup commands, typed command, answers by pattern, kernel assertions) and the `AskUserQuestion` answer hook output
- [x] 4.2 Implement the suite (`evals/suites/stages/`), `--skill <name>`, registration in `pnpm eval` and `pnpm eval check`; README section
- [x] 4.3 Case files: `setup` (happy path on the fixture, refusal case), `change` (happy path with a new branch, `policy/change-exists` refusal, a `tiny` intent)
- [ ] 4.4 `pnpm eval stages --skill setup --probe` and `--skill change --probe` after the cost is approved; confirm the answer hook works or switch to the D8 fallback

## 5. Documentation (D9)

- [x] 5.1 `docs/guide/getting-started/setup.md`, `reference/skills.md`, `reference/artifacts.md`, README skill table; `pnpm docs:build`
- [x] 5.2 Sync the main specs: new `openspec/specs/stage-skills/spec.md`, `skill-evals`, `skill-content-checks`

## 6. Acceptance

- [ ] 6.1 Manual E2E with `claude --plugin-dir`: `/bdk:setup` on a fresh copy of the fixture and on a v2 fixture, then `/bdk:change "<intent>"` with both branch answers; record the outcome in the PR
- [x] 6.2 Full gate: `pnpm build`, lint, format, typecheck, knip, `test:unit`, `test:e2e`, `test:contract`, `skill-check`, `docs:build`, `eval check`, `pytest tests/unit/`
- [x] 6.3 `openspec validate v3-t41-setup-change --strict`

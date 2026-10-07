## 1. Eval cases first

- [x] 1.1 Write the four case directories `plugins/bdk/evals/setup-web-app`, `setup-http-api`, `setup-node-cli`, `setup-library` (prompt, `case.yaml`, `scaffold.sh`, graders per design D9); `setup-library` reuses `fixtures/tiny-ledger.sh`
- [x] 1.2 Run the free check (`pnpm exec vitest run plugins/bdk/tests/evals.test.ts`) and see it load the new cases; confirm a case fails while the skill does not exist (one paid probe run, `--runs 1 --ablation none`, or a manual `claude -p` run in a scaffolded project)

## 2. The skill

- [x] 2.1 Build `plugins/bdk/skills/setup/SKILL.md` with `/skill-creator` (design D1-D8): `!` block, process (state, detect, ask, write settings, check, permissions, OpenSpec, ignore rules, report), re-run path
- [x] 2.2 Write `references/stacks.md` (commands and scoped forms per stack, v2 hints) and `references/e2e.md` (design D4)
- [x] 2.3 Run `bdk-skill-kit:skill-check` on the skill and fix every finding; `claude plugin validate plugins/bdk --strict`
- [x] 2.4 Add the setup cases, their Bash grants and the run command to `plugins/bdk/evals/README.md`

## 3. `bdk openspec install` (problem measured in 4.1: the host stops `cp -R` for approval)

- [x] 3.1 Failing tests first: `src/openspec/tests/install.test.ts` (added, updated, unchanged, JSON schema, `env/schema-missing`) and an end-to-end case in `tests/cli.test.ts` (schema next to the bundle)
- [x] 3.2 Slice `src/openspec/` (index, commands, use-cases, store, render, schema), its row in `src/slices.ts`, the group in `src/main.ts`, spec `bdk-cli/openspec`; the skill calls the command instead of `cp -R`

## 4. Acceptance end to end

- [x] 4.1 Build the plugin; in separate test projects scaffolded from each case (outside this repository), run `claude -p "/bdk:setup" --plugin-dir plugins/bdk`; check `bdk config check` exits 0, `bdk config show` reports configured, `openspec schema which bdk` reports the project, `.gitignore` holds the rules, and `.claude/settings.json` holds the allow rules or the report lists them (the host asks the user to approve that write)
- [x] 4.2 Re-run in one configured project with an argument (`add ...`) and check that comments and other keys stay
- [x] 4.3 Run the eval cases once with the plugin (`--runs 1`) and fix the skill or graders until they pass
- [x] 4.4 Run every CI check (`pnpm check`, `claude plugin validate` of the marketplace and every plugin), `openspec validate v3-181-bdk-setup --strict` and `openspec validate --specs --strict`

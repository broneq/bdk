# Tasks

## 1. Reproduce

- [x] 1.1 Build the bundle. In a fresh temporary git repository with `.claude/rules/naming.md` (no `paths:`, two bullets) and `.claude/rules/api.md` (`paths: ["**"]`, two bullets), run `bdk doctor --json`, `bdk rules import --json` and `bdk rules accept "Use the shared serializer" --prefix API --json`. Verify what #152 and #153 report: doctor gives `rule-without-id` with `repair: bdk rules import`, the import writes `origin: import` rules with `applies: ["**"]`, and both commands write `.claude/rules/bdk-generated*.md`. Keep the commands for the final check in 7.1.

## 2. Kernel: remove export and import (`kernel-cli/rules`, `kernel-cli`)

- [x] 2.1 Write failing tests first. In `rules.e2e.ts`: `bdk rules export` and `bdk rules import` exit 3 with `input/unknown-command`. In `commands.test.ts`: the `accept` scenario `no host file written` (a `.claude/rules/naming.md` stays byte-identical, and the output has no `projection` field). Verify they fail.
- [x] 2.2 Remove the `rules-export` and `rules-import` registrations and handlers, `use-cases/export.ts`, `use-cases/import.ts`, `domain/import.ts` (move `prefixProblem` into `use-cases/write.ts` or `domain/rule.ts`, since `accept` still uses it), `domain/projection.ts` (move `ruleLine` as design D-5 says), and their report, render and schema parts. `accept` stops calling `regenerate`, and `AcceptReport` and `rules-accept.json` lose `projection`. Verify the 2.1 tests pass.
- [x] 2.3 Delete the tests of the removed behaviour: the import and export blocks of `rules.e2e.ts` and `commands.test.ts`, the projection block of `audit.test.ts`, and the projection steps of `acceptance.e2e.ts` 8.2 (the test keeps checking that the lesson recurs and is adopted). Fix the header comment of `acceptance.e2e.ts`. Verify `pnpm test:unit` and `pnpm test:e2e` pass for `kernel/src/rules/`.
- [x] 2.4 Edit the Purpose of `openspec/specs/kernel-cli/rules/spec.md` (`add`, `import`, `export` write -> `accept` writes) and of `openspec/specs/kernel-cli/export/spec.md` (drop the `rules export` clause), as design D-9 says. Verify `openspec validate --specs --strict` passes for both.
- [x] 2.5 Run `pnpm build`. Verify `schema/cli/output/rules-export.json` and `rules-import.json` are gone, the command index no longer lists either command, and `pnpm test:contract` (`cli-contract`, `kernel-contract`, `help`, `state-write-map`) passes. When the CLI contract test reports a design or plan mention of the removed commands, add an allowlist entry with the reason from design D-8.

## 3. Kernel: rule schema and settings messages (`kernel-state`, `kernel-settings`)

- [x] 3.1 Write failing tests: `shared/store/state/tests/rule.test.ts` refuses `origin: import`, and an E2E check that `bdk rules check` exits 2 with `policy/rule-format` naming `origin` for such a file (scenario `origin import is refused`). Verify they fail.
- [x] 3.2 Drop `import` from the `origin` enum and its description in `shared/store/state/rule.ts`. Verify the 3.1 tests pass.
- [x] 3.3 Change `origin: import` to `origin: user` in the fixtures that carry it: `kernel/tests/fixtures/state/.bdk/rules/NODE-1.md`, `kernel/tests/contract/state-merge.test.ts`, `kernel/tests/contract/ctx-skill-output.test.ts`. In `kernel/tests/contract/markdown-prettier.test.ts`, drop the imported rule and the projection from the Markdown kinds it writes. Verify `pnpm test:contract` passes for these files.
- [x] 3.4 Point the `quality` and `rules/` reasons in `shared/config/known.ts` at `bdk rules accept` instead of `bdk rules import`, and update the tests that assert those texts. Verify the config tests pass.

## 4. Kernel: doctor (`kernel-cli/service`)

- [x] 4.1 Write failing tests in `service/tests/use-cases.test.ts` and `service.e2e.ts`: a hand-written `.claude/rules/naming.md` without an id gives no finding, a stale `bdk-generated-scoped.md` gives no finding, and `.bdk/rules/API-1.md` with `origin: import` gives `rules-invalid` with `repair: bdk rules check`. Verify they fail.
- [x] 4.2 Reduce `ruleHealth` to the `rules check` answer (design D-4): it runs only when `.bdk/rules/` exists, and `withoutId`, `drifted`, `carriesId` and the `isProjection` use go. Remove the `rule-without-id` and `projection-outdated` findings from `doctor.ts`. Keep `markdownFiles` only if a caller remains, otherwise delete it. Delete the old tests of the removed findings: the `rule-without-id` and `projection-outdated` cases and the `PROJECTION` fixture in `kernel/src/service/tests/use-cases.test.ts`, and the `rule-without-id` case in `kernel/src/service/tests/service.e2e.ts`. Rename the case "runs no rule check without .bdk/rules/ and .claude/rules/" so it names only `.bdk/rules/`. Verify the 4.1 tests pass, `pnpm test:unit` and `pnpm test:e2e` pass for `kernel/src/service/`, and `pnpm knip` reports nothing unused.
- [x] 4.3 Leave the `.claude/rules/` mentions of design D-10 unchanged: `kernel/src/change/tests/close.test.ts`, `kernel/tests/docs/hook-references.test.ts`, and the `kernel-cli/change`, `docs-site` and `rule-pack` specs. Verify `git diff --stat` does not list them.

## 5. Skills, README and user docs (`stage-skills`, `tools-skills`)

- [x] 5.1 Update the content tests first: `kernel/tests/contract/stage-skills.test.ts` (close names neither `bdk rules export` nor `.claude/rules/`, and setup does not name `bdk rules import`), and `kernel/tests/contract/tools-skills.test.ts` (rules `check` and removal run `bdk rules check` only, and name neither `bdk rules export` nor `.claude/rules/`; doctor names neither removed command). Verify they fail.
- [x] 5.2 Edit `skills/stages/close/SKILL.md` (drop step 3 and the regenerated files from the report and the description), `skills/stages/setup/SKILL.md` (drop "Hand-written rules"), `skills/tools/rules/SKILL.md` (intro, `check`, "Removing a rule") and `skills/tools/doctor/SKILL.md` (the example repair). Verify the 5.1 tests pass, and verify `pnpm skill-check` passes.
- [x] 5.3 Update the `/bdk:rules` row of `README.md` so it no longer mentions the projection.
- [x] 5.4 Update the user guide: `concepts/quality-and-language-rules.md`, `workflows/rules-hygiene.md`, `getting-started/setup.md`, `getting-started/migration-from-v2.md`, `reference/artifacts.md`, `reference/skills.md` and `troubleshooting.md`. Add a short migration note for a project that ran `bdk rules import`: set `origin: user` in the rules it keeps or delete them, and delete `.claude/rules/bdk-generated*.md`. Update `.claude/skills/docs-sync/references/docs-map.md`. Verify with `/docs-sync` against the diff, and verify `pnpm docs:build` passes.

## 6. BDK's own repository rules (`plugin-tooling`)

- [x] 6.1 Write `.claude/rules/skills.md` and `.claude/rules/prompts.md` with `paths: ["skills/**", "agents/**"]`, and `.claude/rules/repo.md` without `paths:`, one bullet per rule with the text of the current `.bdk/rules/` file and no id (design D-7). Delete `.bdk/rules/`, `.claude/rules/bdk-generated.md` and `.claude/rules/bdk-generated-scoped.md`. Verify the 13 texts are carried over word for word (`git diff --stat` and a manual comparison).
- [x] 6.2 Delete `kernel/tests/contract/repo-rules.test.ts`. Update `CLAUDE.md` (the `.bdk/rules/` line of the architecture block, the note under it, and the bullet on adopting a development rule) and `CONTRIBUTING.md` (development rules are hand-written `.claude/rules/` files that pass the admission test). Verify `pnpm test:contract` passes, and verify `bdk doctor --json` in the repository reports no `rules-invalid` finding (scenario `doctor on the BDK repository`).

## 7. Acceptance

- [x] 7.0 Sync the main specs with the deltas of this change (`/opsx:sync`), as earlier changes did before their contract gate. Verify the `cli-contract` checks that compare the specs with the command index pass, which also closes 2.5.
- [x] 7.1 Rerun the 1.1 reproduction against the new bundle. Verify: `bdk rules import` and `bdk rules export` exit 3 with `input/unknown-command`, `bdk doctor --json` reports nothing about `.claude/rules/`, `bdk rules accept` writes only `.bdk/rules/API-1.md` (and the guard), and `.claude/rules/` is byte-identical to before.
- [x] 7.2 Run `rtk proxy grep -rnE "rules (import|export)|bdk-generated|projection-outdated|rule-without-id"` over `kernel/src`, `kernel/tests`, `skills`, `agents`, `hooks`, `rules`, `docs/guide` (excluding `.vitepress`), `openspec/specs`, `README.md`, `CLAUDE.md` and `CONTRIBUTING.md`. Verify the only hits are the migration note and allowlist entries.
- [x] 7.3 Run `pnpm lint && pnpm format:check && pnpm typecheck && pnpm knip`, `pnpm test:unit`, `pnpm build && pnpm test:e2e`, `pnpm test:contract` and `pnpm skill-check`, and verify all of them pass.
- [x] 7.4 Run `openspec validate v3-152-remove-rules-export-import --strict` and verify it reports the change as valid.

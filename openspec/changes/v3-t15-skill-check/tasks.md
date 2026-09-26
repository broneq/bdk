# Tasks

Groups 1-6 run in a new local repository `bdk-skill-kit`, a sibling of the BDK checkout. Groups 7-11 run in this BDK worktree. Specs in BDK: `skill-content-checks`, `kernel-architecture` (CI pipeline). The kit's own spec `skill-kit` lives in the kit's OpenSpec root (D-2). Design references are D-n in design.md.

## 1. Kit scaffold (D-1, D-3)

- [x] 1.1 Create the local repository with `package.json` (name `bdk-skill-kit`, exact pins, `engines.node >=22.18.0`, `bin`, `exports`, no lifecycle scripts: pnpm runs `prepare` of a git dependency, so contributors install the hooks with `pnpm hooks`), `.nvmrc` 24, `tsconfig.json`, ESLint, Prettier, knip, commitlint, husky with lint-staged, `.editorconfig`, `LICENSE` (MIT), and verify `pnpm install && pnpm typecheck && pnpm lint` pass on an empty `src/index.ts`
- [x] 1.2 Add the esbuild build (`src/cli.ts` to `dist/skill-check.mjs`, `src/index.ts` to `dist/index.mjs`, declarations to `dist/index.d.ts`, `yaml` bundled, only `node:` imports left). Write a test that fails when a bundle imports anything but `node:`, then make it pass, and verify `pnpm build` produces all three files
- [x] 1.3 Add `.claude-plugin/plugin.json` (name `bdk-skill-kit`, no `bin/`), Vitest with coverage thresholds 90 / 90 / 90 / 85, and CI (`ci.yml`: Node 22.18 / 24 / 26, install, build, `git diff --exit-code dist/`, lint, format check, typecheck, knip, unit, fixtures, self-check; actionlint) plus `release-please.yml` (`release-type: node`, extra file `.claude-plugin/plugin.json`), and verify `claude plugin validate .` passes

## 2. Core engine (D-4, D-9)

- [x] 2.1 Write failing unit tests for document parsing: frontmatter map with per-key lines, body lines with file line numbers, code-fence mask, skill directory file list, unclosed or non-map frontmatter as a parse finding
- [x] 2.2 Implement the parser and verify 2.1 passes
- [x] 2.3 Write failing tests for config loading and target discovery: `defineConfig` / `definePlugin` defaults, `.ts` / `.mjs` / `.js` lookup and `--config`, unknown rule ID, missing target dir, failing plugin load, portable agents target (all exit 2 with the offending entry on stderr), namespaced plugin rule IDs, severity overrides, path arguments narrowing per-file rules only
- [x] 2.4 Implement config, plugin loading, discovery and the rule runner (per-file and project rules), and verify 2.3 passes
- [x] 2.5 Write failing tests for output and exit codes: human line format and summary, GitHub annotations when `GITHUB_ACTIONS` is set, `--json` shape as the only stdout, exit 0 / 1 / 2, `--strict`
- [x] 2.6 Implement the reporters and the CLI entry (`--help` included), and verify 2.5 passes plus an E2E test that runs `dist/skill-check.mjs` in a child process

## 3. Profiles and generic rules (D-5, D-6)

- [x] 3.1 Add the fixture harness: `fixtures/clean/` plus `fixtures/violations/<rule-id>/`, and a test that runs the CLI per fixture and asserts that the clean tree gives exit 0 and each rule fixture gives exit 1 with only its own rule ID. Add the coverage test that fixture names equal the catalogue IDs, and verify it fails for every rule not yet implemented
- [x] 3.2 Add the profile field lists (one dated source file with URLs) with failing unit tests for the portable and claude-code skill and agent lists and the plugin-ignored agent fields. Then implement `fields`, `field-values` and `invocation`, and verify the tests and their fixtures pass
- [x] 3.3 Write failing unit tests, then implement `frontmatter`, `name-format` (with `prefix`), `name-matches-dir`, `skill-file-name`, `description` (profile caps and `when_to_use`), `description-front-loaded`, `body`, `line-limit` and `require-model`, and verify the unit tests and their fixtures pass
- [x] 3.4 Write failing unit tests, then implement `absolute-paths`, `model-names` (frontmatter `model` exempt) and `arguments-typo`, and verify the unit tests and their fixtures pass
- [x] 3.5 Write failing unit tests, then implement `references` (resolution error, second-level warning), `unused-files`, `layout` and the project rule `unique-names`, and verify the unit tests and their fixtures pass
- [x] 3.6 Write failing unit tests for `cli-front` (invocable, 30 lines, `--help` mention, flag count, flag or subcommand table), then implement it, and verify the tests and its fixture pass

## 4. Baseline (D-7)

- [x] 4.1 Write failing tests: fingerprint stable under inserted lines above, suppression only of matching findings, `baseline-stale` error and exit 1, new finding in a baselined file reported, `--baseline-init` refusing an existing file with exit 2, `--baseline-prune` removing stale entries and never adding
- [x] 4.2 Implement the baseline and verify 4.1 passes

## 5. Kit skills (D-8, D-14)

- [x] 5.1 Write the kit's sync test: the generic rule IDs cited in backticks under `skills/skill-authoring/` equal the catalogue IDs. Verify it fails on the missing skill
- [x] 5.2 Write `skills/skill-authoring/SKILL.md` (<= 200 lines) and `references/` (`frontmatter.md`, `structure.md`, `process-vs-knowledge.md`, `cli-fronting.md`), distilled from BDK's `.claude/rules/skill-creation-rules.md`, `skill-structure.md`, `portability-check.md`, the Agent Skills specification, T02 "Process vs knowledge test", R-6 and R-13, without BDK-specific rules. Verify the sync test passes
- [x] 5.3 Write `skills/skill-check/SKILL.md` (portable fields, `metadata.fronts-cli: skill-check`, `allowed-tools` for the node invocation, <= 30 lines), and verify `node dist/skill-check.mjs --portable` over `skills/` exits 0
- [x] 5.4 Write `README.md` (install through the BDK marketplace and by git tag, config and plugin examples, rule catalogue link to the kit's `openspec/specs/skill-kit`), and verify every command in it runs as written
- [x] 5.5 Initialise OpenSpec in the kit (`openspec init --tools claude`, project `config.yaml`, generated files in `.prettierignore`) and write the living spec `openspec/specs/skill-kit/spec.md` from this Change's former `skill-kit` delta, updated to the implemented behaviour. Verify `openspec validate skill-kit --strict` and `pnpm format:check` pass in the kit

## 6. Kit release

- [x] 6.1 Run the full kit CI locally (build, bundle diff, lint, format, typecheck, knip, unit with coverage, fixtures, self-check), and verify all pass
- [x] 6.2 Ask the user to confirm creating the public repository `broneq/bdk-skill-kit`. After confirmation, create it, push, and verify the CI run on GitHub is green
- [x] 6.3 Cut `v0.1.0` (release-please initial PR or a manual tag, whichever the user prefers), and verify the tag exists on a commit with a green CI run

## 7. BDK dependency and configuration (D-11)

- [x] 7.1 Add `bdk-skill-kit` as a devDependency pinned to `github:broneq/bdk-skill-kit#v0.1.0` (bumped to `v0.1.1`, which fixes an EPIPE crash when the output is piped into `head`, then to `v0.1.2` for the `bdk-skill-kit/testing` rule tester and stable fingerprints) and the script `skill-check`, and verify `pnpm install --frozen-lockfile` and `pnpm skill-check --help` succeed
- [x] 7.2 Add `tools/**/*.ts` to `tsconfig.json`, `knip.json` and the ESLint scope, and verify `pnpm typecheck && pnpm lint && pnpm knip` pass

## 8. BDK rule plugin (D-10, D-12)

- [x] 8.1 Add `tools/skill-check/fixtures/` (clean tree with skills, a gate skill, adapters and a portable craft target, plus `skill-check.fixture.config.ts`) and the contract test in the `contract` Vitest project: clean exit 0, each rule fixture exit 1 with only its rule, fixture set equals enabled rule set, skip below Node 22.18 with a stated reason. Verify it fails for every `bdk/*` rule
- [x] 8.2 Write the wrapper-regex parity contract test against the `content-wrapper` block of `openspec/specs/kernel-cli/spec.md`, and verify it fails before the plugin exists
- [x] 8.3 Implement `bdk/wrapper-form` and `bdk/wrapper-allowed-tools` in `tools/skill-check/bdk-rules.ts`, and verify their unit tests, fixtures and the parity test pass
- [x] 8.4 Write failing unit tests, then implement `bdk/no-mcp-tools`, `bdk/gate-invocation` and `bdk/gate-disallowed-tools`, and verify the unit tests and their fixtures pass
- [x] 8.5 Write failing unit tests, then implement `bdk/adapter-shape` and `bdk/craft-no-kernel`, and verify the unit tests and their fixtures pass. The `fields` fixture in the portable target sets `disable-model-invocation` and is reported
- [x] 8.6 Write failing unit tests, then implement `bdk/no-language-commands` (with the `setup` exemption) and `bdk/namespaced-refs` (skills and `subagent_type`, other plugins as warnings), and verify the unit tests and their fixtures pass, with the whole fixture contract test green

## 9. BDK config, baseline, CI, pre-commit (D-11, D-13)

- [x] 9.1 Write `skill-check.config.ts` (skills and agents targets, plugin, limits from `skill-content-checks`) and run `pnpm skill-check --baseline-init`. Verify that the baseline lists only v2 skills and agents and that `pnpm skill-check` then exits 0
- [x] 9.2 Replace the stub in `.github/workflows/tests.yml` with the skill content job (pnpm, Node from `.nvmrc`, frozen install, `pnpm skill-check`), and verify actionlint passes
- [x] 9.3 Add the lint-staged entry `"{skills,agents}/**": () => "pnpm skill-check"`, and verify that staging a seeded violation under `skills/` makes the commit fail
- [x] 9.4 Add the `bdk-skill-kit` entry to `.claude-plugin/marketplace.json` through a separate PR into `main` (#80), because the marketplace is read from the default branch, and verify `claude plugin validate .` passes and `staging/v3` picks the entry up from `main` (cherry-picked with `-x` into this branch: a full merge of `main` into `staging/v3` conflicts in 19 v2 files and is its own task)

## 10. Dev-time lints and docs (D-15)

- [x] 10.1 Reduce `.claude/skills/skill-lint/SKILL.md` to skill-lint 4, 5 and the prose half of 22, and `.claude/skills/agent-lint/SKILL.md` to agent-lint 4, 5, 15, each opening with "run `pnpm skill-check` first". Verify `pnpm skill-check` still exits 0
- [x] 10.2 Update `CLAUDE.md` Development Commands and `CONTRIBUTING.md` with `pnpm skill-check` and the baseline rule (prune, never add). In `.claude/rules/skill-creation-rules.md`, replace the outdated description cap and the `arguments` ban with a pointer to the kit's rules. Verify the documented commands run as written
- [x] 10.3 Mark T15 in `docs/V3-IMPLEMENTATION-PLAN.md` with the resolved package name, and add the handoff to T42: add the `bdk-craft` portable target and remove the baseline entries of replaced skills. Verify `pnpm format:check` passes

## 11. Acceptance

- [x] 11.1 Acceptance signal, end to end:
  - the kit release `v0.1.0` exists with a green CI run of its own tests;
  - BDK's CI run on the PR is green with the skill content job running `skill-check` over `skills/` and `agents/`;
  - the fixture contract test shows exit 1 for a seeded violation of every enabled rule;
  - the portable fixture fails with a `fields` error for a Claude-only field.

  Record the run links in the PR description

- [x] 11.2 Run `openspec validate v3-t15-skill-check --strict` and verify it passes

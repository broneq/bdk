# Tasks

## 1. Start and toolchain

- [x] 1.1 Confirm issue #49's card shows "In progress" on the project board (moved at change creation); verify with `gh project item-list 1 --owner broneq --format json`
- [x] 1.2 Add root `package.json` (`type: module`, `engines.node: ">=22.13.0"`, exact `packageManager: pnpm@<version>`, exact-pinned dev dependencies `typescript`, `esbuild`, `vitest`, `@vitest/coverage-v8`, `eslint`, `typescript-eslint`, `eslint-config-prettier`, `prettier`, `husky`, `lint-staged`, `@commitlint/cli`, `@commitlint/config-conventional`, `knip`, `ajv`, `@types/node`; runtime `zod`, `yaml`; scripts `build`, `lint`, `format`, `format:check`, `typecheck`, `knip`, `test:unit`, `test:e2e`, `test:contract`, `prepare`), `tsconfig.json` (design D-2 flags), `.gitignore` entries `node_modules/` and `coverage/`, `.gitattributes` marking `dist/bdk.mjs` `linguist-generated=true -diff`, `.nvmrc` (24), `.editorconfig`; verify `pnpm install --frozen-lockfile` succeeds after the lockfile is committed
- [x] 1.3 Add `eslint.config.mjs` (type-checked `typescript-eslint`, `eslint-config-prettier`), `vitest.config.ts` (projects `unit`, `e2e`, `contract`; coverage thresholds of design D-2 on `unit`), `knip.json`, `.prettierrc.json` and `.prettierignore` (design D-2); verify each tool runs on the empty `kernel/` and that ESLint and knip fail on a seeded violation (negative control)
- [x] 1.4 Run `pnpm format` over the repository as its own commit `style: format the repository with Prettier`; verify `tests/contract/cli-contract.test.mjs` (`node --test tests/contract/*.test.mjs`) and `pytest tests/unit/` still pass and that `docs/v3/`, `CHANGELOG.md` and `openspec/changes/archive/` are untouched
- [x] 1.5 Add husky (`prepare` script) with `pre-commit` running lint-staged (`eslint --fix` and `prettier --write` on staged `*.ts`, `prettier --write` on staged JSON, YAML and Markdown) and `commit-msg` running commitlint (`commitlint.config.mjs` extending `@commitlint/config-conventional`); verify a commit with an unformatted file is formatted by the hook and a commit message `bad message` is rejected
- [x] 1.6 Add the esbuild build (design D-3: `--target=node22.13`, ESM, `dist/bdk.mjs`, index inlined) over a placeholder `kernel/src/main.ts`; verify `pnpm build` twice in a row leaves `git diff --exit-code dist/` clean (deterministic output) and `pnpm lint`, `pnpm format:check`, `pnpm typecheck` and `pnpm knip` pass
- [x] 1.7 Document the Node toolchain in `CONTRIBUTING.md` and the Development Commands of `CLAUDE.md` (Node from `.nvmrc`, `pnpm install` installs the hooks, `pnpm build`, `pnpm lint`, `pnpm format`, `pnpm test:unit|e2e|contract`, `dist/bdk.mjs` is committed and rebuilt, never edited); verify every documented command runs as written

## 2. shared/refusal and shared/output

- [x] 2.1 Write failing unit tests for `shared/refusal`: class-to-exit mapping for all six classes, `refuse()` yields exactly the four fields, the catalogue union rejects an unknown rule at type level (a `// @ts-expect-error` line checked by `pnpm typecheck`); verify `pnpm test:unit` fails
- [x] 2.2 Implement `shared/refusal` (design D-6); verify 2.1 passes
- [x] 2.3 Write failing unit tests for `shared/output`: JSON writer prints one object, four-line refusal text, STOP block exactly two lines, text writer caps at 100 lines, list page `items` / `total` / `truncated` / `for` with and without `--all`; verify they fail
- [x] 2.4 Implement `shared/output`; verify 2.3 passes

## 3. shared/registry, main.ts and the E2E harness

- [x] 3.1 Build the E2E support: `kernel/tests/support/fixture.ts` (temp git repository with requested files, cleanup) and `kernel/tests/support/run.ts` (spawns `dist/bdk.mjs` with `process.execPath`, returns code, stdout, stderr, parsed JSON), with a unit test of the fixture itself; verify `pnpm test:unit` passes
- [x] 3.2 Write failing unit tests for the registry pipeline (design D-5): unknown command with the closest id, `--help` before any check, unknown flag, missing argument, literal outside `values`, runtime check order, the runtime floor with an injected Node version (22.12.9 gives exit 5 with an install line for an ordinary record, exit 0 for `version`), `nodeGate: false` registration, stub answer with owner task in `why` and `instead`, and the three mode wrappers (command exit by class, inject exit 0 with STOP block, guard exit 2 with stderr and never 3-5); verify they fail
- [x] 3.3 Implement `shared/registry` with the runtime checks as injected functions (the work tree check arrives with `shared/git` in 6.2) and `kernel/src/main.ts` (composition root, top-level catch per mode); verify 3.2 passes
- [x] 3.4 Write the `--help` parity contract test (usage text lists exactly the record's arguments, flags and exit codes, stubs included, `kernel-cli` Invocation scenarios help parity and help for a stubbed command); verify it passes

## 4. shared/clock and shared/ids

- [x] 4.1 Write failing unit tests: system clock format `YYYY-MM-DDTHH:MM:SSZ`, fixed clock injection, id prefixes, qualified reference parse (`<changeId>/L-m2x9v`, bare id, malformed input); verify they fail
- [x] 4.2 Implement `shared/clock` and the provisional `shared/ids` (design D-6, format owned by T14); verify 4.1 passes

## 5. shared/store

- [x] 5.1 Write failing unit tests against the `Store` interface, run on both the in-memory and the file system implementation: project root discovery (nearest `.bdk/`, else work tree root), read, atomic write leaves no temp file, list, exists, frontmatter split; verify they fail
- [x] 5.2 Implement `shared/store` without the index; verify 5.1 passes
- [x] 5.3 Write a failing test for the index skeleton: lazy `node:sqlite` open creates `.bdk/.machine/index.sqlite` with the `meta` schema version, sets the busy timeout, and emits no `ExperimentalWarning` on stderr (design D-3); verify it fails
- [x] 5.4 Implement the index skeleton with the dynamic `import("node:sqlite")`; verify 5.3 passes and the built bundle has no static `node:sqlite` import

## 6. shared/git and shared/config

- [x] 6.1 Write failing unit tests for `shared/git`: work tree detection for a `.git` directory, a `.git` file (linked worktree) and no repository; `run()` maps a missing executable to `runtime/git-missing`; rebase, merge and cherry-pick markers map to `policy/git-in-progress`; verify they fail
- [x] 6.2 Implement `shared/git`; verify 6.1 passes
- [x] 6.3 Write failing unit tests for `shared/config`: plugin manifest version read relative to the bundle and the `0.0.0-unknown` fallback (design D-4), the reading half of the four layers returns each present file's parsed object with its layer name and skips absent ones, a YAML syntax error names the file; verify they fail
- [x] 6.4 Implement `shared/config`; verify 6.3 passes
- [x] 6.5 Wire the Node and work tree checks into `main.ts`, then write the failing E2E enumeration `kernel/tests/contract.e2e.ts` over all 61 records (stub answer per mode plus `--help` per record, `runtime/not-a-repo` outside a work tree, `kernel-architecture` Tests per slice as modified) and rebuild the bundle; verify it passes and that no case sees exit 1

## 7. service slice: version and doctor

- [x] 7.1 Write failing unit tests for `service/domain` (semver compare against 22.13.0 including 22.12.9, 22.13.0, 26.9.0; layout classification v2 / v3 / none) and the `doctor` and `version` use cases on the in-memory store (v2 finding with `repair: bdk import`, Node finding with an install line, healthy project with empty findings); verify they fail
- [x] 7.2 Implement the slice in the anatomy of design D-7 (commands, use cases, domain, render, zod schemas), register `doctor` with `nodeGate: false`; verify 7.1 passes
- [x] 7.3 Write the failing E2E `kernel/src/service/tests/service.e2e.ts`: every `exits` value and rule the two records declare, the `kernel-cli/service` scenarios as modified (example runs validate against `schema/cli/output/doctor.json` and `schema/cli/common/version.json` with Ajv, v2 layout, healthy project, no `uv` finding, text form `bdk <version> (contract 3, node <version>)`), `runtime/not-a-repo` outside a work tree for `doctor` and exit 0 for `version`; rebuild the bundle; verify it passes
- [x] 7.4 Update the `examples` entry of `schema/cli/output/doctor.json` to the Node 22.12.0 example of the `kernel-cli/service` delta; verify the Ajv and zod example checks of 8.2 pass

## 8. Contract, structure and dependency tests

- [x] 8.1 Port `tests/contract/cli-contract.test.mjs` to Vitest as `kernel/tests/contract/cli-contract.test.ts` and delete the old file; verify the ported suite passes with the same test names under `pnpm test:contract`
- [x] 8.2 Add contract tests: every record has a handler or the stub, the `shared/refusal` catalogue union equals the spec catalogue, every `examples` entry in `schema/cli/output/` and `schema/cli/common/` validates with Ajv, and the zod schemas of `version`, `doctor`, the refusal and the list page parse their examples (design D-8); verify they pass and fail on a seeded broken example
- [x] 8.3 Write the import scan and the `node:` boundary test (design D-8, matrix read from the `kernel-architecture` table); verify they pass on the tree and fail on a seeded deep import, a reverse edge, a `render/` to `use-cases/` import and a `node:fs` import in `service/`
- [x] 8.4 Write the bundle and dependency tests: `dist/bdk.mjs` imports only `node:` specifiers; runtime dependencies within `zod`, `yaml`; no range in any dependency version; verify they pass and fail on a seeded range and a seeded extra runtime dependency

## 9. CI and dependency updates

- [ ] 9.1 Rewrite `.github/workflows/tests.yml` per design D-9: keep `pytest`; add `kernel` (matrix 22.13 / 24 / 26 with every step of the `CI pipeline` requirement in order, identical on every line), `lint-repo` (actionlint over `.github/workflows/`; on pull requests commitlint `--from` base `--to` head), `audit` (`pnpm audit --prod --audit-level high`), `skill-check` (stub that prints "skill-check lands in T15" and exits 0); remove the T10 `contract` job; verify with `actionlint` locally and by the green run in 12.1
- [x] 9.2 Add `.github/dependabot.yml` (npm and github-actions, monthly, one group each; design D-10); verify it parses and note in the PR description that it takes effect once it reaches `main`

## 10. Spec follow-up outside the delta

- [x] 10.1 Edit the Purpose paragraph of `openspec/specs/kernel-cli/service/spec.md` so its list of common rules says `runtime/node-version` does not apply to `doctor` (a delta cannot change a Purpose); verify the ported contract tests still pass

## 11. Decision records

- [x] 11.1 Write `docs/adr/0002-kernel-runtime-node-typescript.md` (D5, recording the development toolchain as amended by design D-2), `0003-artifact-graph-as-data.md` (A-podejście), `0004-configuration-yaml-and-markdown.md` (R-format) and `0005-markdown-truth-sqlite-index.md` (R-store) in the MADR template of `skills/create-adr/SKILL.md`, status `accepted`, each citing its register entry and design section and listing the rejected alternatives (design D-12), or have the user run `/bdk:create-adr` for each; verify the four files exist, follow the template's sections and contain no em dash
- [ ] 11.2 Draft the ADR 0001 amendment for `broneq/git-identity` (design D-12, including the rule 2 sentence if the user agrees with the Open Question), show it to the user, and on approval open the PR in that repository; verify the PR URL is recorded in this Change's PR description

## 12. Acceptance

- [ ] 12.1 Push the branch and open the PR into `staging/v3`; verify CI is green with the steps build, `git diff --exit-code dist/`, lint, format check, typecheck, knip, unit with coverage, E2E and contract on 22.13 / 24 / 26, plus `lint-repo`, `audit` and `skill-check`
- [ ] 12.2 Run the acceptance signal by hand on a v2 fixture: `node dist/bdk.mjs doctor` in a temp git repository with `.bdk/settings.json` prints the `v2-layout` finding with `bdk import`; `node dist/bdk.mjs change status` under Node 22.12.0 (`nvm exec 22.12`) exits 5 with an install line; verify both outputs are quoted in the PR description
- [ ] 12.3 Run `openspec validate v3-t11-kernel-skeleton --strict`; verify it reports the change as valid

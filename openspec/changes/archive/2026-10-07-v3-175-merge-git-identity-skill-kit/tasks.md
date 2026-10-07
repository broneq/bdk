# Tasks

## 1. Import the histories

- [x] 1.1 Fresh-clone `broneq/git-identity` and `broneq/bdk-skill-kit` into the scratchpad, run `git filter-repo --to-subdirectory-filter plugins/<name> --tag-rename v:<name>--v --replace-message <rules>` on each (D1, D2); verify with `git log --format='%h %an %ad %s'` and `git tag` that every `main` commit and every tag is there under its new form, and that no message still holds a bare `#N` reference
- [x] 1.2 Check the rewritten commit messages with the root `commitlint` config; add a message rule for each non-merge commit it rejects and rerun 1.1 until it passes
- [x] 1.3 Merge each rewritten `main` into the Change branch with `git merge --allow-unrelated-histories` and a Conventional merge message; verify `git log --oneline -- plugins/git-identity` and `git log --oneline -- plugins/bdk-skill-kit` list the original commits

## 2. Workspace and release wiring

- [x] 2.1 Write the failing workspace tests first: manifest entry equals `plugin.json` version for each plugin; every `git-subdir` marketplace entry on `broneq/bdk` names an existing plugin directory with the same manifest name; no plugin directory holds its own tool config, lockfile or `.github/`; verify they fail on the merged tree
- [x] 2.2 Register `plugins/git-identity` and `plugins/bdk-skill-kit` in `release-please-config.json` (component, pre-major rules, D3) and seed `.release-please-manifest.json` with `0.2.0` and `0.3.0`; verify `tests/release-components.test.ts` and the manifest test pass
- [x] 2.3 Switch both marketplace entries to `git-subdir` at `plugins/<name>`, `ref: release` (D9) and point each `plugin.json` `repository` at `broneq/bdk`; verify the marketplace test passes and `claude plugin validate .claude-plugin/marketplace.json --strict` passes

## 3. git-identity onto the root toolchain

- [x] 3.1 Port `hooks/session-start.test.mjs` to `tests/session-start.test.ts` (Vitest, same cases); verify it runs in `pnpm test` and passes against the unchanged hook
- [x] 3.2 Replace the plugin's tooling: drop `biome.json`, `.github/`, `.nvmrc`, `.gitignore`, `pnpm-lock.yaml`; rewrite `package.json` (no version, `typecheck` script) and `tsconfig.json` (extends root, `allowJs`/`checkJs`, hooks and tests); verify `pnpm typecheck` covers the hook by adding a deliberate JSDoc type error, seeing it fail, and removing it
- [x] 3.3 Extend the root ESLint config to `plugins/*/hooks/**/*.mjs` with the typed rules (D4); fix what it reports; verify `pnpm lint` and `pnpm format:check` pass
- [x] 3.4 Update the plugin's `CLAUDE.md` and `README.md` commands and paths to the monorepo; verify every command they name runs from the stated directory

## 4. bdk-skill-kit onto the root toolchain

- [x] 4.1 Write the failing test first: `skill-check --version` from source and from the bundle prints the `plugin.json` version after `package.json` loses its version; then read the version from `../.claude-plugin/plugin.json` and verify the test passes
- [x] 4.2 Write the failing self-check test first (the built CLI over the kit's own `skills/` with `skill-check.config.ts` exits 0); verify it fails on a seeded violation and passes on the real skill
- [x] 4.3 Untrack `dist/`, drop `.gitattributes`, `.github/`, `.husky/`, `.claude/`, `.editorconfig`, `.gitignore`, `.nvmrc`, `.prettierignore`, `.prettierrc.json`, `commitlint.config.mjs`, `eslint.config.mjs`, `knip.json`, `pnpm-lock.yaml`, `vitest.config.ts`; move `build.mjs` to `build.ts`; rewrite `package.json` (no version, no husky/knip/lint-staged, `files` with `.claude-plugin/plugin.json`) and `tsconfig.json` (extends root); verify `pnpm --filter bdk-skill-kit build` writes all five `dist/` files
- [x] 4.4 Move the Vitest setup into the root config (D6): plugin `vitest.setup.ts` discovered by glob, coverage with the kit's per-glob thresholds, `testTimeout`; add `@vitest/coverage-v8` at the root; verify `pnpm test` runs every kit test with coverage and fails when a threshold is raised above the measured value
- [x] 4.5 Add `plugins/bdk-skill-kit/fixtures/` to the root `.prettierignore`; verify `pnpm format:check` and `pnpm lint` pass over the kit
- [x] 4.6 Move `openspec/specs/skill-kit/` and the three archived changes into the root `openspec/` with `git mv`, drop the kit's `openspec/config.yaml` (D8); verify `openspec validate --specs --strict` passes
- [x] 4.7 Update the kit's `README.md` (install from the `release` branch, monorepo development commands, no committed `dist/`); verify every command it names runs
- [x] 4.8 Verify a git-dependency install of the built kit with a `path:` selector works: build a local snapshot of the plugin as the publish job does, commit it to a scratch git repository, install it with pnpm in a scratch project with `--frozen-lockfile`, and run `skill-check --help`

## 5. Try the plugins

- [x] 5.1 In a separate test project, start `claude --plugin-dir plugins/git-identity` and `claude --plugin-dir plugins/bdk-skill-kit` (after `pnpm build`) in print mode; verify the SessionStart hook loads without error and `/bdk-skill-kit:skill-check` runs the CLI

## 6. Acceptance and gates

- [x] 6.1 Check the acceptance signal: `git log -- plugins/git-identity` and `git log -- plugins/bdk-skill-kit` show the original history; `claude plugin validate --strict` passes on both plugin directories and on the marketplace
- [x] 6.2 Run every check of `.github/workflows/pr.yml`: `pnpm install --frozen-lockfile`, `pnpm check`, marketplace and per-plugin strict validation, `commitlint` over `staging/v3..HEAD`, the docs build if its inputs changed, `openspec validate v3-175-merge-git-identity-skill-kit --strict` and `openspec validate --specs --strict`
- [x] 6.3 Push the branch, then the rewritten tags (D11); verify `git ls-remote --tags origin '*--v*'` lists them
- [x] 6.4 Commit a README pointing to `broneq/bdk` to each old repository, then archive both; verify `gh repo view <repo> --json isArchived` reports `true`

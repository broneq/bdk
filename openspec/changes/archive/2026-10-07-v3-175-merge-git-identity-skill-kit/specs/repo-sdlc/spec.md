# Spec Delta

## ADDED Requirements

### Requirement: Every plugin uses the root toolchain
A plugin directory under `plugins/` SHALL NOT carry its own lint, format, test or commit tooling (no Biome, ESLint, Prettier, Vitest, commitlint, husky or knip config, no lockfile, no `.github/` directory). Its TypeScript and JavaScript SHALL be linted by the root ESLint config, formatted by the root Prettier config, typechecked by `pnpm typecheck` and tested by the root Vitest suite, so the `check` job covers it.

#### Scenario: Plugin test runs in the workspace suite
- **WHEN** a contributor runs `pnpm test` at the repository root
- **THEN** the tests of `plugins/git-identity` and `plugins/bdk-skill-kit` run in that suite

#### Scenario: Type error in a plugin hook
- **WHEN** a pull request adds a JSDoc type error to `plugins/git-identity/hooks/session-start.mjs`
- **THEN** the `check` job fails at the typecheck step

#### Scenario: Plugin with its own tool config
- **WHEN** a pull request adds a `biome.json`, `eslint.config.*`, `vitest.config.*`, `pnpm-lock.yaml` or `.github/` under `plugins/<name>/`
- **THEN** the `check` job fails at the test step and names the file

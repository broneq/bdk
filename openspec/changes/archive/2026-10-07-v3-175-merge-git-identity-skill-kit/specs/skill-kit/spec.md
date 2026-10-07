# Spec Delta

## ADDED Requirements

### Requirement: Distribution from the BDK repository

The kit SHALL live in the repository `broneq/bdk` under `plugins/bdk-skill-kit/`, and that directory SHALL be a Claude Code plugin. The CLI and the library SHALL be bundled ES modules (`dist/skill-check.mjs`, `dist/index.mjs` with `dist/index.d.ts`, `dist/testing.mjs` with `dist/testing.d.ts`) that import only `node:` modules, built by the kit's `build` script. `dist/` SHALL NOT be committed; the release job SHALL build it and publish it with the rest of the plugin, `package.json` included, to the `release` branch. A consumer SHALL be able to install a release as a git dependency on a commit of the `release` branch with the path `plugins/bdk-skill-kit` and run `skill-check` without a build or install script, so `package.json` SHALL declare no lifecycle script that runs on install. The kit's skills SHALL invoke the CLI as `node ${CLAUDE_PLUGIN_ROOT}/dist/skill-check.mjs`, and the plugin SHALL NOT have a `bin/` directory. The kit SHALL require Node 22.18 or newer, so that a TypeScript config or plugin loads without a build step.

#### Scenario: install from the release branch

- **WHEN** a project adds `github:broneq/bdk#<release-commit>&path:/plugins/bdk-skill-kit` as a devDependency and installs with a frozen lockfile
- **THEN** `skill-check --help` runs, and no lifecycle script of the kit ran during installation

#### Scenario: no committed bundle

- **WHEN** a contributor runs `git ls-files plugins/bdk-skill-kit/dist`
- **THEN** the output is empty

#### Scenario: bundles import only Node built-ins

- **WHEN** the kit's tests inspect `dist/skill-check.mjs`, `dist/index.mjs` and `dist/testing.mjs`
- **THEN** every import specifier starts with `node:`, and `dist/index.d.ts` imports no other file

## REMOVED Requirements

### Requirement: Distribution

**Reason**: The kit moved from `broneq/bdk-skill-kit` into `broneq/bdk` under `plugins/bdk-skill-kit/`, and `dist/` is no longer committed; replaced by "Distribution from the BDK repository".

**Migration**: Pin a commit of the `release` branch of `broneq/bdk` with the path `plugins/bdk-skill-kit` instead of a tag of `broneq/bdk-skill-kit`. Existing tag pins keep working, because the archived repository stays readable.

## MODIFIED Requirements

### Requirement: Release with its own tests

Every kit release SHALL be a tag `bdk-skill-kit--v<version>`, cut by release-please from Conventional Commits on `main` of `broneq/bdk`, whose commit passed the pull request CI. release-please SHALL bump `version` in `.claude-plugin/plugin.json`, the kit's only version; `package.json` SHALL carry no version. The CLI SHALL read its version from `.claude-plugin/plugin.json` at run time. The pull request CI SHALL run over the kit: lint, format check, typecheck, unit tests with coverage thresholds of 90% lines, functions and statements and 85% branches, the fixture suite of every generic rule, `skill-check` over the kit's own `skills/` with the kit's config, and the build. It SHALL run on the Node version of the repository's `.nvmrc`.

#### Scenario: a generic rule without a fixture

- **WHEN** a generic rule is added to the catalogue without a seeded-violation fixture
- **THEN** the kit's fixture suite fails, and with it the `check` job at the test step

#### Scenario: the kit checks itself

- **WHEN** a kit skill fails a generic rule
- **THEN** the kit's self-check test fails, and with it the `check` job at the test step

#### Scenario: version from the plugin manifest

- **WHEN** `version` in `plugins/bdk-skill-kit/.claude-plugin/plugin.json` reads `0.4.0`
- **THEN** `skill-check --version` prints `0.4.0`, from the sources and from the built bundle

#### Scenario: coverage below the threshold

- **WHEN** a change leaves the kit's sources below 90% line coverage
- **THEN** `pnpm test` fails and names the threshold

### Requirement: Kit skill

The kit's plugin SHALL ship one skill, `skill-check`, passing every generic rule with the kit's config. It SHALL be checked in the `claude-code` profile, because it runs the plugin's bundled CLI through `${CLAUDE_PLUGIN_ROOT}`. It SHALL declare `metadata.fronts-cli: skill-check`, pre-approve `Bash(node ${CLAUDE_PLUGIN_ROOT}/dist/skill-check.mjs *)` in `allowed-tools`, pass `cli-front`, and tell the agent to run `--explain <rule>` on a finding and to run the checker after each iteration of a skill it is writing. The kit SHALL ship no prose of its own on how to write a skill: that is Anthropic's Agent Skills best practices and the `skill-creator` skill, and what a rule asks is its explanation.

#### Scenario: the kit ships one skill

- **WHEN** the kit's tests list `skills/`
- **THEN** the only entry is `skill-check`

#### Scenario: the kit checks itself

- **WHEN** `skill-check` fails a generic rule with the kit's config
- **THEN** the kit's self-check test fails, and with it the `check` job at the test step

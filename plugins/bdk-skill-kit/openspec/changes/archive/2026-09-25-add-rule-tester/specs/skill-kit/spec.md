# Spec Delta

## MODIFIED Requirements

### Requirement: Distribution

The kit SHALL live in the repository `broneq/bdk-skill-kit`, and the repository SHALL be a Claude Code plugin. The CLI and the library SHALL be committed as bundled ES modules (`dist/skill-check.mjs`, `dist/index.mjs` with `dist/index.d.ts`, `dist/testing.mjs` with `dist/testing.d.ts`) that import only `node:` modules. A consumer SHALL be able to install a release as a git-tag dependency and run `skill-check` without a build or install script, so `package.json` SHALL declare no lifecycle script that runs on install. The kit's skills SHALL invoke the CLI as `node ${CLAUDE_PLUGIN_ROOT}/dist/skill-check.mjs`, and the plugin SHALL NOT have a `bin/` directory. The kit SHALL require Node 22.18 or newer, so that a TypeScript config or plugin loads without a build step.

#### Scenario: install by tag

- **WHEN** a project adds `github:broneq/bdk-skill-kit#v0.1.0` as a devDependency and installs with a frozen lockfile
- **THEN** `skill-check --help` runs, and no lifecycle script of the kit ran during installation

#### Scenario: committed bundle is the build

- **WHEN** the kit's CI builds the sources
- **THEN** `git diff --exit-code dist/` passes

#### Scenario: bundles import only Node built-ins

- **WHEN** the kit's tests inspect `dist/skill-check.mjs`, `dist/index.mjs` and `dist/testing.mjs`
- **THEN** every import specifier starts with `node:`, and `dist/index.d.ts` imports no other file

## ADDED Requirements

### Requirement: Rule tester

The kit SHALL export `checkRule(rule, input)` from `bdk-skill-kit/testing`, so a plugin author can unit test one rule in process. `checkRule` SHALL resolve to the findings of that rule alone, in the CLI's report order, with each file path relative to the target directory.

- `input` SHALL carry `files`, a map of paths relative to one target directory to file contents, and MAY carry `kind` (`skills` by default), `profile` (`claude-code` by default) and `options`.
- It SHALL discover, parse and check the files with the same code the CLI uses, and SHALL merge `options` over the rule's default options as a config setting does.
- It SHALL run `check` for each document of a matching kind and `checkProject` once, and SHALL run the rule even when its default severity is `off`, at `error`; otherwise at the rule's default severity. A report with `severity: "warning"` SHALL stay capped at warning.
- It SHALL reject a target that the config loader rejects, such as a portable agents target, and a `files` path that is absolute or leaves the target directory.
- It SHALL leave no files behind, also when the rule throws.
- The main entry `bdk-skill-kit` SHALL NOT load the tester, and the tester SHALL run on Node versions without TypeScript type stripping.

#### Scenario: a per-document rule

- **WHEN** a test calls `checkRule` with a rule that reports on every skill and `files` holding `plan/SKILL.md`
- **THEN** the result holds one finding with the rule's ID and the file `plan/SKILL.md`

#### Scenario: a project rule

- **WHEN** a test calls `checkRule` with a `checkProject` rule and two skills
- **THEN** the rule runs once and receives both documents

#### Scenario: options are merged over the defaults

- **WHEN** a rule has default options `{ a: 1, b: 2 }` and the test passes `options: { b: 3 }`
- **THEN** the rule sees `{ a: 1, b: 3 }`

#### Scenario: a rule that is off by default

- **WHEN** a test checks a rule whose default severity is `off`
- **THEN** the rule runs and its findings have severity `error`

#### Scenario: the portable profile

- **WHEN** a test passes `profile: "portable"`
- **THEN** each document's target has the portable profile

#### Scenario: the temporary directory is removed

- **WHEN** `checkRule` returns or the rule throws
- **THEN** the directory the files were written to no longer exists

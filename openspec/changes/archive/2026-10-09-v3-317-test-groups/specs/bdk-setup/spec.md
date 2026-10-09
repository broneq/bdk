## MODIFIED Requirements

### Requirement: Stack detection

The skill SHALL detect `languages` and the `tools.test`, `tools.lint` and `tools.build` items from the project's files, preferring the project's own scripts run through the package manager its lockfile names over direct tool calls. Each item SHALL have a kebab-case `id` naming the runner or checker (never the package manager), unique in its group, one `command`, and a `when` naming its check points (spec `bdk-cli/config`). Where a runner takes a list of files, the skill SHALL write an item whose command holds `{files}` and whose `id` ends in `-changed` (or names the related-tests mode, `vitest-related`), next to the item of the whole command when the project has one. It SHALL give the items these points:

| Item | `when` |
|---|---|
| a linter, formatter check or test runner on the changed files (`{files}`) | `[part]` |
| a linter or formatter check of the whole project | `[review]` |
| a type check (`tsc --noEmit`, `mypy`, `go vet`) | `[wave, review]` |
| the project's main test script | `[wave, review]` |
| an integration, slow or heavy test script | `[review]` |
| an E2E runner (Playwright, Cypress) on the changed spec files | `[part]` |
| the whole E2E suite | `[review]` |
| build | `[review]` |

It SHALL write only detected keys to `.bdk/settings.yaml` and leave every other key on its default.

#### Scenario: Scripts through the package manager

- **WHEN** the project has `pnpm-lock.yaml` and a `package.json` script `test` running `vitest run`
- **THEN** `.bdk/settings.yaml` holds a `tools.test` item `vitest` with `command: pnpm test` and `when: [wave, review]`, and a `tools.test` item whose `command` runs vitest on `{files}` with `when: [part]`

#### Scenario: Playwright suite split by point

- **WHEN** the project has a `test:e2e` script running `playwright test` on the specs under `e2e/`
- **THEN** `.bdk/settings.yaml` holds a `tools.test` item running the whole suite with `when: [review]`, and an item `playwright-changed` whose command runs Playwright on `{files}`, with `paths` matching only the spec files under `e2e/` and `when: [part]`

#### Scenario: Defaults stay out of the file

- **WHEN** setup writes a fresh `.bdk/settings.yaml`
- **THEN** the file holds no `policy`, `plan`, `execution` or `hooks` key, and no item holds `scoped`

### Requirement: Permission allow rules

The skill SHALL add to `permissions.allow` of the project's `.claude/settings.json` each of these rules that is missing, keeping every existing entry and key of the file: `Bash(bdk *)`, `Bash(*/bin/bdk *)`, `Bash(openspec *)`, `Bash(git *)`, `Bash(gh *)`, `Bash(<command>)` for every `tools.test`, `tools.lint` and `tools.build` command without `{files}` and every `tools.e2e` `start` or command `ready`, and `Bash(<prefix> *)` for every command holding `{files}`, where `<prefix>` is the command before `{files}`. Claude Code asks the user to approve a write to `.claude/settings.json`; when the write is refused, the report SHALL list the rules for the user to add.

#### Scenario: Rules merged into existing settings

- **WHEN** `.claude/settings.json` already allows `Read` and sets `model`
- **THEN** after setup the file still allows `Read`, still sets `model`, and also allows `Bash(bdk *)`, `Bash(git *)`, `Bash(gh *)` and the detected test command

#### Scenario: Rule for a command on changed files

- **WHEN** setup writes the item `eslint-changed` with `command: pnpm eslint {files}`
- **THEN** the rules hold `Bash(pnpm eslint *)`

### Requirement: Re-run keeps the project's choices

When the project is already configured, the skill SHALL keep every value a layer sets, change only what the user's arguments ask for or what `bdk config check` reports as a problem, add only missing rules and ignore entries, and copy the BDK schema again. An item holding the removed field `scoped` SHALL be rewritten into two items: the item keeps its `id` and `command` and gets `when: [wave, review]` (`[review]` for a lint or build item), and a new item `<id>-changed` gets the `scoped` command and `when: [part]`. An item without `when` SHALL be left as it is, since it runs at every point. Edits to `.bdk/settings.yaml` SHALL keep its comments and key order.

#### Scenario: Targeted re-run

- **WHEN** `/bdk:setup add the e2e entry` runs in a configured project with a comment in `.bdk/settings.yaml`
- **THEN** only `tools.e2e` changes in that file and the comment is still there

#### Scenario: Scoped item rewritten

- **WHEN** `/bdk:setup` runs in a project whose `.bdk/settings.yaml` holds the `tools.test` item `vitest` with `command: pnpm test` and `scoped: pnpm vitest run {files}`
- **THEN** the file holds the item `vitest` with `command: pnpm test` and `when: [wave, review]` and the item `vitest-changed` with `command: pnpm vitest run {files}` and `when: [part]`, no item holds `scoped`, and `bdk config check` exits 0

### Requirement: Eval cases

The `bdk` eval suite SHALL hold `block` cases for the skill: `setup-web-app`, `setup-web-no-playwright`, `setup-http-api`, `setup-node-cli`, `setup-claude-plugin`, `setup-library`, `setup-multi-package`, `setup-existing-openspec` and `setup-scoped-rewrite`, at least one per product kind of "E2E entry by product kind", each grading the written `.bdk/settings.yaml` and `openspec/config.yaml`, the installed schema, the permission rules in the reply (Claude Code refuses a write to `.claude/settings.json` in an eval run) and that the skill fired. The two web cases SHALL also grade how the reply says Playwright will run, and that the test items carry `when`: a vitest item on `{files}` at `part` and the whole test script at `wave`. `setup-web-app` SHALL also put a `lavish-axi` stand-in that answers `--version` into the workspace and grade that the reply reports the Lavish page; `setup-library` SHALL put a stand-in that fails into the workspace and grade that the reply reports `AskUserQuestion` and suggests installing `lavish-axi`. `setup-multi-package` SHALL run on a fixture with `api/` and `web/` packages and grade that each check item's `paths` cover only its package; `setup-web-app` SHALL grade that no item whose command lacks `{files}` has `paths`. `setup-existing-openspec` SHALL start from a project with `schema: spec-driven` and the v2 `/.bdk/` ignore rule, and grade that the schema line is kept and that the reply names the removed rule. `setup-scoped-rewrite` SHALL start from a configured project whose `.bdk/settings.yaml` holds an item with `scoped` and a comment, and grade that no item holds `scoped`, that the comment is kept, that the item keeps its command at `wave`, and that a `{files}` item runs at `part`.

#### Scenario: Cases load in CI

- **WHEN** `pnpm test` runs the free eval check
- **THEN** the nine `setup-*` cases load with no error at zero cost

#### Scenario: Both decision surfaces graded

- **WHEN** the `setup-*` cases run
- **THEN** `setup-web-app` grades the Lavish line of the report and `setup-library` grades the `AskUserQuestion` line

#### Scenario: Multi-package paths graded

- **WHEN** `setup-multi-package` runs
- **THEN** it grades that the `api` items' `paths` match no `web/` file and the `web` items' `paths` match no `api/` file

#### Scenario: Check points graded

- **WHEN** `setup-web-app` runs
- **THEN** it grades a `tools.test` item whose command runs vitest on `{files}` with `when: [part]` and an item `command: pnpm test` whose `when` holds `wave`

### Requirement: Paths for check items in a repository of several packages

The skill SHALL write `paths` on a `tools.test`, `tools.lint` or `tools.build` item when the item's command covers only a part of the repository, so that `bdk check run` hands the item only its own changed files, or runs its whole command only when one of them changed. A test or build item of a package in its own directory SHALL get `<dir>/**`. A lint item whose tool reads one file type SHALL get `<dir>/**/*.<ext>` for each extension the tool reads. When the packages share the repository root, an item SHALL get `**/*.<ext>` for the extensions of its tool's language. An item whose command holds `{files}` SHALL also get `paths` naming the files its tool reads (`**/*.<ext>` for a linter or test runner, the spec files for an E2E runner), so a changed Markdown or YAML file is never handed to it. The skill SHALL NOT write `paths` on an item whose whole command covers the whole repository, so a single-package repository gets `paths` only on its `{files}` items, and one root command that runs every package gets none.

#### Scenario: Python API and web frontend

- **WHEN** `/bdk:setup` runs in a repository with `api/` (uv, pytest, ruff) and `web/` (pnpm, vitest, eslint)
- **THEN** `.bdk/settings.yaml` gives the `pytest` items `paths` that match only files under `api/`, the `ruff` items `paths` that match only `.py` files under `api/`, and the `vitest` and `eslint` items `paths` that match only files under `web/`
- **AND** `bdk check run <run-dir> <stage> --at part --scope web/src/a.tsx` runs only the `web` items and lists the `api` items as skipped

#### Scenario: Single package

- **WHEN** `/bdk:setup` runs in a repository with one `package.json` at its root
- **THEN** no check item whose command lacks `{files}` has `paths`

# bdk-setup Specification

## Purpose

Defines the `/bdk:setup` skill of the `bdk` plugin: how it turns a project into a configured BDK project in one command - stack detection, `.bdk/settings.yaml`, permission allow rules, OpenSpec with the BDK schema, ignore rules - and how it detects `tools.e2e` for web, API and CLI products.

## Requirements

### Requirement: Setup leaves a configured project

`/bdk:setup` SHALL be a skill of the `bdk` plugin (`plugins/bdk/skills/setup/`) that runs in a project without a BDK configuration. When it ends without an unanswered blocker, `bdk config check` SHALL exit 0 in the project and `bdk config show` SHALL report the project configured (status `ok`), so that every other BDK skill runs past its configuration check. The skill SHALL end with a report listing every value it wrote with the project file it was detected from, every file it created or changed, and anything left for the user. It SHALL NOT commit.

#### Scenario: Fresh project

- **WHEN** `/bdk:setup` runs in a git project with a `package.json`, no `.bdk/` and no `openspec/`
- **THEN** afterwards `bdk config check` exits 0, `bdk config show` prints no "BDK not configured" line, and `git status` shows the new files uncommitted

#### Scenario: Report names the sources

- **WHEN** setup has written `tools.test` from the `test` script of `package.json`
- **THEN** its report names that command and `package.json` as its source

### Requirement: Stack detection

The skill SHALL detect `languages` and the `tools.test`, `tools.lint` and `tools.build` items from the project's files and its map, preferring the project's own scripts run through the package manager its lockfile names over direct tool calls. Each item SHALL have a kebab-case `id` naming the runner or checker (never the package manager), unique in its group, one `command`, and a `when` naming its check points (spec `bdk-cli/config`). Where a runner takes a list of files, the skill SHALL write an item whose command holds `{files}` and whose `id` ends in `-changed` (or names the related-tests mode, `vitest-related`), next to the item of the whole command when the project has one. It SHALL give the items these points:

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

When the project runs a suite through a wrapper script (a script that starts the runner with a budget, a server, a container, an environment or a retry around it), or a rule or hook forbids the bare runner, the item SHALL run the wrapper as the project calls it and no item SHALL run the bare runner. A `{files}` item SHALL go through the wrapper only when the wrapper passes extra arguments to the runner; otherwise the suite SHALL get no `{files}` item and the report SHALL say why. When the wrapper, a rule or the CI workflow gives the suite a time budget over 600 seconds, the item SHALL get a `timeout` above that budget. A rule that says when to run a suite (a heavy suite for some changes) SHALL be named in the report next to the item. A script with a side effect beyond the check (a `build` that deploys) SHALL get no item. It SHALL write only detected keys to `.bdk/settings.yaml` and leave every other key on its default.

#### Scenario: Scripts through the package manager

- **WHEN** the project has `pnpm-lock.yaml` and a `package.json` script `test` running `vitest run`
- **THEN** `.bdk/settings.yaml` holds a `tools.test` item `vitest` with `command: pnpm test` and `when: [wave, review]`, and a `tools.test` item whose `command` runs vitest on `{files}` with `when: [part]`

#### Scenario: Playwright suite split by point

- **WHEN** the project has a `test:e2e` script running `playwright test` on the specs under `e2e/`
- **THEN** `.bdk/settings.yaml` holds a `tools.test` item running the whole suite with `when: [review]`, and an item `playwright-changed` whose command runs Playwright on `{files}`, with `paths` matching only the spec files under `e2e/` and `when: [part]`

#### Scenario: Suite behind a wrapper

- **WHEN** the project's `test:e2e` script runs `scripts/run-e2e.sh`, which runs `playwright test "$@"` under a time budget, and a hook in `.claude/settings.json` blocks a direct `playwright test`
- **THEN** every `tools.test` item that runs the Playwright suite runs it through `scripts/run-e2e.sh` or `test:e2e`, and no item's command runs `playwright test` itself

#### Scenario: Wrapper budget over the default timeout

- **WHEN** the E2E wrapper stops the suite after 900 seconds
- **THEN** the item that runs the whole suite through the wrapper has a `timeout` of at least 900

#### Scenario: Java suite behind a wrapper

- **WHEN** a Maven project runs its Cypress suite under `e2e/` only through `scripts/e2e.sh`, which builds the app, starts it with the `e2e` profile and runs `cypress run`
- **THEN** `.bdk/settings.yaml` holds a `tools.test` item running the Maven tests and a `tools.test` item running `scripts/e2e.sh`, and no item's command runs `cypress run` itself

#### Scenario: Defaults stay out of the file

- **WHEN** setup writes a fresh `.bdk/settings.yaml`
- **THEN** the file holds no `policy`, `plan`, `execution` or `hooks` key, and no item holds `scoped`

### Requirement: E2E entry by product kind

The skill SHALL write one `tools.e2e` item per runnable product of the project, classified by what a user runs:

| Product | `id` | `driver` | `start` | `ready` |
|---|---|---|---|---|
| web app (a UI framework or bundler, or an end-to-end browser test config) | `web` | `browser` | the Playwright `webServer.command` when present, else the dev script (`dev`, then `start`) through the package manager | the Playwright `webServer.url` when present, else `http://localhost:<port>` with the port from the script, the framework config or the framework default |
| HTTP API (a server framework and no UI) | `api` | `http` | the start script or the framework's run command | `http://localhost:<port>` followed by the health route when the code has one, else `/` |
| Claude Code plugin (a `.claude-plugin/plugin.json`) | `plugin` | `cli` | the build command that makes the plugin loadable, else the same command as `ready` | `claude plugin validate <plugin dir>` |
| CLI (a `bin` entry, `[project.scripts]`, a Go `main` package without a server, a Rust binary) | `cli` | `cli` | the build command that makes the binary runnable, else the same command as `ready` | the CLI's help invocation |

When the project's own E2E suite starts the server itself (a global setup, a fixture or a wrapper script that starts it, and no `webServer`), `start` SHALL be the server command that suite runs, with the port, profile and non-secret environment it uses, and `ready` the URL the suite drives; a `dev` or `start` script that the map shows needs a cloud deployment or a secret SHALL NOT be taken. When the suite also starts a service the server needs that no one command starts, the skill SHALL prefer a project script that starts both, and otherwise SHALL ask with the suite's server command as the recommended answer and name the service in the report.

A Claude Code plugin SHALL be classified as a plugin even when it also ships a `bin` entry: its user runs its skills and hooks in a Claude Code session, not the binary. Several products in one workspace SHALL get one item each, the `id` suffixed with the package name. A project with no runnable product SHALL get no `tools.e2e` item, and the report SHALL say that E2E is skipped and why. `env` SHALL be written only for a variable the start command needs, with a non-secret local value the project documents. `browser` SHALL NOT be written: the tester then uses `playwright`, and a user who wants `chrome-devtools-mcp` sets it.

#### Scenario: Web app with Playwright

- **WHEN** the project has `vite` and `react` dependencies and a `playwright.config.ts` whose `webServer` has `command: "pnpm dev"` and `url: "http://localhost:5173"`
- **THEN** `.bdk/settings.yaml` holds a `tools.e2e` item `web` with `driver: browser`, `start: pnpm dev` and `ready: http://localhost:5173`

#### Scenario: Suite owns the server

- **WHEN** the project's Playwright config has no `webServer`, its `globalSetup` starts `next dev --port 3100` with a local backend mode, and the README says `pnpm dev` needs a cloud deployment and auth keys
- **THEN** the `tools.e2e` item `web` has a `start` that runs the server on port 3100 as the global setup does, not `pnpm dev`, and `ready: http://localhost:3100`, and setup asks no question about it

#### Scenario: Java app started by the E2E wrapper

- **WHEN** a Spring Boot project's E2E wrapper starts the app on port 8081 with the `e2e` profile and its default profile needs a PostgreSQL server
- **THEN** the `tools.e2e` item has a `start` that runs the app with the `e2e` profile and `ready: http://localhost:8081`

#### Scenario: HTTP API

- **WHEN** the project is an Express server listening on port 4000 with a `/health` route and a `start` script
- **THEN** `.bdk/settings.yaml` holds a `tools.e2e` item `api` with `driver: http` and `ready: http://localhost:4000/health`

#### Scenario: CLI

- **WHEN** `package.json` declares `"bin": {"ledger": "bin/ledger.js"}` and the project starts no server
- **THEN** `.bdk/settings.yaml` holds a `tools.e2e` item `cli` with `driver: cli` and a `ready` command that runs the CLI with `--help`

#### Scenario: Claude Code plugin

- **WHEN** the project holds `.claude-plugin/plugin.json`, `skills/` and a `bin/` launcher
- **THEN** `.bdk/settings.yaml` holds a `tools.e2e` item `plugin` with `driver: cli` and a `ready` command `claude plugin validate` naming the plugin directory, and no item that only runs the launcher with `--help`

#### Scenario: Library

- **WHEN** the project exports functions and has no UI, server or `bin`
- **THEN** `.bdk/settings.yaml` holds no `tools.e2e` item and the report says E2E is skipped because there is nothing to run

#### Scenario: Chrome DevTools MCP server configured

- **WHEN** a web app's `.mcp.json` declares a server running `npx chrome-devtools-mcp@latest`
- **THEN** its `tools.e2e` item `web` holds no `browser` field, and the report says the tester uses Playwright and that `browser: chrome-devtools-mcp` selects the server

### Requirement: Playwright for the browser item

For a `browser` item, the skill SHALL check whether the project has Playwright (`@playwright/test` or `playwright` among the dependencies of the package that holds the web app) and whether a browser is at hand for it (the Chromium that Playwright installed, else the system Chrome). When the package is a Node package and either is missing, it SHALL ask, in its one round of questions, whether to install what is missing, recommending yes: `@playwright/test@1.63.0` as a dev dependency through the project's package manager, and Chromium through that Playwright (`playwright install chromium`). On yes it SHALL install them and check that the package now resolves; on no, or when it cannot ask, it SHALL install nothing. Its report SHALL say in one line how the E2E tester will run Playwright: with the project's own Playwright, or, when the project has none, with Playwright 1.63.0 installed for each run into a scratch directory; and when no browser is at hand, it SHALL name `npx -y playwright@1.63.0 install chromium`.

#### Scenario: Install accepted

- **WHEN** setup runs in a pnpm Vite web app without Playwright and the user accepts the install
- **THEN** `package.json` lists `@playwright/test` among its dev dependencies, Chromium for it is installed, and the report says the E2E tester uses the project's Playwright

#### Scenario: Cannot ask

- **WHEN** setup runs in a Vite web app without Playwright where it cannot ask a question
- **THEN** `package.json` is unchanged, the report says the E2E tester installs Playwright 1.63.0 for each run and names the install it would have made, and `.bdk/settings.yaml` holds no setting naming `chrome-devtools-axi`

#### Scenario: Web app with its own Playwright

- **WHEN** setup runs in a web app with `@playwright/test` among its dev dependencies and Playwright's Chromium installed
- **THEN** setup asks nothing about Playwright and the report says the E2E tester uses the project's Playwright

### Requirement: Ask only what the files cannot answer

The skill SHALL detect everything before it writes, and SHALL ask the user at most one round of questions, only for what the project files leave open: competing commands for a group, a group without a command, an E2E start command or port the files do not settle, an existing `openspec/config.yaml` naming a schema other than `bdk` ("OpenSpec with the BDK schema"), deleting v2 files, and installing Playwright for a `browser` item ("Playwright for the browser item"). Each question SHALL put the recommended answer first. When nothing is open, it SHALL ask nothing. When it cannot ask, it SHALL take the recommended answers and name them in the report, except that it SHALL NOT delete files and SHALL NOT install anything without an answer.

#### Scenario: Nothing to ask

- **WHEN** every group has exactly one detected command, the E2E entry is fully detected, the web app has Playwright and a browser for it, and the project has no `openspec/` yet
- **THEN** setup writes the configuration without asking a question

### Requirement: Permission allow rules

The skill SHALL add to `permissions.allow` of the project's `.claude/settings.json` each of these rules that is missing, keeping every existing entry and key of the file: `Bash(bdk *)`, `Bash(*/bin/bdk *)`, `Bash(openspec *)`, `Bash(git *)`, `Bash(gh *)`, `Edit(.bdk/runs/**)` (so the output redirect of a check line passes, spec `bdk-cli/check`), `Bash(<command>)` for every `tools.test`, `tools.lint` and `tools.build` command without `{files}` and every `tools.e2e` `start` or command `ready`, and `Bash(<prefix> *)` for every command holding `{files}`, where `<prefix>` is the command before `{files}`. When a `tools.test`, `tools.lint` or `tools.build` item has a `timeout` above 600 seconds, the skill SHALL also set `env.BASH_MAX_TIMEOUT_MS` in the same file to the largest such `timeout` in milliseconds, unless the file already sets a larger value, so the agent's Bash call of that item is not cut at the Bash tool's default cap of 600 seconds. Claude Code asks the user to approve a write to `.claude/settings.json`; when the write is refused, the report SHALL list the rules for the user to add.

#### Scenario: Rules merged into existing settings

- **WHEN** `.claude/settings.json` already allows `Read` and sets `model`
- **THEN** after setup the file still allows `Read`, still sets `model`, and also allows `Bash(bdk *)`, `Bash(git *)`, `Bash(gh *)` and the detected test command

#### Scenario: Rule for a command on changed files

- **WHEN** setup writes the item `eslint-changed` with `command: pnpm eslint {files}`
- **THEN** the rules hold `Bash(pnpm eslint *)`

#### Scenario: Long E2E suite

- **WHEN** setup writes the `tools.test` item `playwright` with `timeout: 1500` and `.claude/settings.json` sets no `env`
- **THEN** the file holds `env.BASH_MAX_TIMEOUT_MS: "1500000"` and the allow rule `Edit(.bdk/runs/**)`

### Requirement: OpenSpec with the BDK schema

The skill SHALL initialise OpenSpec when the project has no `openspec/`, with OpenSpec 1.13.2 and no tool integration (`openspec init --tools none`), using `npx -y @fission-ai/openspec@1.13.2` when the installed `openspec` is missing or another version. When no OpenSpec CLI can run, it SHALL write the layout `openspec init` writes (`openspec/config.yaml`, `openspec/specs/`, `openspec/changes/archive/`) and the report SHALL tell the user to install OpenSpec 1.13.2. It SHALL install the plugin's `openspec/schemas/bdk/` into `openspec/schemas/bdk/` of the project with `bdk openspec install` on every run.

It SHALL set `schema: bdk` in `openspec/config.yaml`, keeping the rest of that file, only when this run created `openspec/`, when the file names no schema, or when the user agreed to switch. When the project's `openspec/config.yaml` existed before the run and names another schema, the skill SHALL ask whether to make `bdk` the project's default schema, recommending to keep the project's schema; when it cannot ask, or the user keeps it, it SHALL leave the `schema:` line unchanged and the report SHALL say that the project keeps its schema and that BDK opens its own Changes with `--schema bdk`.

#### Scenario: Schema installed and default

- **WHEN** setup has run in a project without `openspec/` and the OpenSpec CLI is available
- **THEN** `openspec/schemas/bdk/schema.yaml` exists, `openspec/config.yaml` sets `schema: bdk`, and `openspec schema which bdk` reports the project as its source

#### Scenario: Existing OpenSpec project

- **WHEN** the project already has `openspec/` with `schema: spec-driven`, a `context:` that names that schema and its own specs, and setup cannot ask a question
- **THEN** setup does not run `openspec init`, keeps the specs, installs the BDK schema, leaves `schema: spec-driven` and the `context:` text unchanged, and the report says the project keeps `spec-driven` and that BDK Changes are opened with `--schema bdk`

#### Scenario: User agrees to switch

- **WHEN** the project already has `openspec/` with `schema: spec-driven` and the user answers to switch to `bdk`
- **THEN** `openspec/config.yaml` sets `schema: bdk` and keeps every other line

### Requirement: Git ignore rules and v2 projects

The skill SHALL make `.gitignore` hold `/.bdk/runs/` and `/.bdk/settings.local.yaml`, adding each one that is missing. When `.bdk/settings.yaml` is ignored by a rule of the project (the v2 `/.bdk/` rule), it SHALL replace that rule with those two paths, so the project layer is committed, and the report SHALL name the removed rule, the file it was in and why in a line of its own. Once that rule is gone, every untracked path under `.bdk/` other than `.bdk/settings.yaml` that the two entries do not cover (a local `.bdk/tmp/`, v2 files the user kept) SHALL get an ignore entry of its own, `/.bdk/<name>` with a trailing `/` for a directory, so nothing the old rule hid shows up as a new file; the report SHALL list those entries, and the skill SHALL delete none of them. A v2 `.bdk/settings.json` SHALL be read as detection hints, and the v2 paths SHALL be deleted only after the user agrees.

#### Scenario: v2 ignore rule replaced

- **WHEN** `.gitignore` holds `/.bdk/` from BDK v2
- **THEN** after setup `git check-ignore .bdk/settings.yaml` exits 1, `git check-ignore .bdk/runs/x` exits 0, and the report names the removed `/.bdk/` rule of `.gitignore` and says that `.bdk/settings.yaml` is now tracked

#### Scenario: Local content under .bdk kept ignored

- **WHEN** `.gitignore` holds `/.bdk/` and the project has an untracked `.bdk/tmp/notes.md`
- **THEN** after setup `git check-ignore .bdk/tmp/notes.md` exits 0, the file still exists, and the report names the entry `/.bdk/tmp/`

### Requirement: Re-run keeps the project's choices

When the project is already configured, the skill SHALL keep every value a layer sets, change only what the user's arguments ask for or what `bdk config check` reports as a problem, add only missing rules and ignore entries, and copy the BDK schema again. An item holding the removed field `scoped` SHALL be rewritten into two items: the item keeps its `id` and `command` and gets `when: [wave, review]` (`[review]` for a lint or build item), and a new item `<id>-changed` gets the `scoped` command and `when: [part]`. An item without `when` SHALL be left as it is, since it runs at every point. Edits to `.bdk/settings.yaml` SHALL keep its comments and key order.

#### Scenario: Targeted re-run

- **WHEN** `/bdk:setup add the e2e entry` runs in a configured project with a comment in `.bdk/settings.yaml`
- **THEN** only `tools.e2e` changes in that file and the comment is still there

#### Scenario: Scoped item rewritten

- **WHEN** `/bdk:setup` runs in a project whose `.bdk/settings.yaml` holds the `tools.test` item `vitest` with `command: pnpm test` and `scoped: pnpm vitest run {files}`
- **THEN** the file holds the item `vitest` with `command: pnpm test` and `when: [wave, review]` and the item `vitest-changed` with `command: pnpm vitest run {files}` and `when: [part]`, no item holds `scoped`, and `bdk config check` exits 0

### Requirement: Eval cases

The `bdk` eval suite SHALL hold `block` cases for the skill: `setup-web-app`, `setup-web-no-playwright`, `setup-http-api`, `setup-node-cli`, `setup-claude-plugin`, `setup-library`, `setup-multi-package`, `setup-existing-openspec`, `setup-scoped-rewrite`, `setup-node-wrapper` and `setup-java-cypress`, at least one per product kind of "E2E entry by product kind", each granting the `Agent` tool so setup starts the explorer, each grading the written `.bdk/settings.yaml` and `openspec/config.yaml`, the installed schema, the permission rules in the reply (Claude Code refuses a write to `.claude/settings.json` in an eval run) and that the skill fired. The two web cases SHALL also grade how the reply says Playwright will run, and that the test items carry `when`: a vitest item on `{files}` at `part` and the whole test script at `wave`. `setup-web-app` SHALL also put a `lavish-axi` stand-in that answers `--version` into the workspace and grade that the reply reports the Lavish page; `setup-library` SHALL put a stand-in that fails into the workspace and grade that the reply reports `AskUserQuestion` and suggests installing `lavish-axi`. `setup-multi-package` SHALL run on a fixture with `api/` and `web/` packages and grade that each check item's `paths` cover only its package; `setup-web-app` SHALL grade that no item whose command lacks `{files}` has `paths`. `setup-existing-openspec` SHALL start from a project with `schema: spec-driven` and the v2 `/.bdk/` ignore rule, and an untracked `.bdk/notes/` the rule hid, and grade that the schema line is kept, that the reply names the removed rule, and that `.gitignore` holds an entry for `.bdk/notes/`. `setup-scoped-rewrite` SHALL start from a configured project whose `.bdk/settings.yaml` holds an item with `scoped` and a comment, and grade that no item holds `scoped`, that the comment is kept, that the item keeps its command at `wave`, and that a `{files}` item runs at `part`. `setup-node-wrapper` SHALL run on a Node + Playwright project with an E2E budget wrapper, a hook that blocks a direct `playwright test`, a Playwright `globalSetup` that starts the server, a `build` script that deploys and a `chromatic` script, and grade that the explorer ran, that the Playwright items run the wrapper and the whole-suite item has a `timeout` of at least its budget, that the E2E `start` and `ready` match the global setup, that no item runs the deploying `build`, and that the reply names each left-out tool with a reason. `setup-java-cypress` SHALL run on a Maven project with a Cypress suite behind a wrapper that starts the app with an `e2e` profile and a Gatling load test, and grade the Maven test item, the wrapper item, the E2E `start` and `ready` of the `e2e` profile, and the reply's line for Gatling. The block `explore-project` SHALL have the case `explore-project-map`, on the fixture of `setup-node-wrapper`, grading that the map names the wrapper, the global setup, the hook and the deploying `build`.

#### Scenario: Cases load in CI

- **WHEN** `pnpm test` runs the free eval check
- **THEN** the eleven `setup-*` cases and `explore-project-map` load with no error at zero cost

#### Scenario: Both decision surfaces graded

- **WHEN** the `setup-*` cases run
- **THEN** `setup-web-app` grades the Lavish line of the report and `setup-library` grades the `AskUserQuestion` line

#### Scenario: Multi-package paths graded

- **WHEN** `setup-multi-package` runs
- **THEN** it grades that the `api` items' `paths` match no `web/` file and the `web` items' `paths` match no `api/` file

#### Scenario: Check points graded

- **WHEN** `setup-web-app` runs
- **THEN** it grades a `tools.test` item whose command runs vitest on `{files}` with `when: [part]` and an item `command: pnpm test` whose `when` holds `wave`

#### Scenario: Two stacks graded

- **WHEN** `setup-node-wrapper` and `setup-java-cypress` run
- **THEN** each grades that its E2E suite runs through its wrapper, that its `tools.e2e` `start` and `ready` match what the suite starts, and that the reply names each left-out tool with a reason

### Requirement: Setup reports the decision surface

The skill SHALL run `npx -y lavish-axi --version` once on every run, a re-run included, and its report SHALL hold one line naming the decision surface the project gets: "questions and triage use a Lavish page" when the command exits 0, and "questions and triage use AskUserQuestion; install lavish-axi for a browser review page" when it exits non-zero or cannot run. The skill SHALL NOT install Lavish and SHALL NOT write a setting or a permission rule for it.

#### Scenario: Lavish runs

- **WHEN** `/bdk:setup` runs in a project where `npx -y lavish-axi --version` exits 0
- **THEN** the report says that questions and triage use a Lavish page

#### Scenario: Lavish does not run

- **WHEN** `/bdk:setup` runs in a project where `npx -y lavish-axi --version` exits non-zero
- **THEN** the report says that questions and triage use `AskUserQuestion` and that installing `lavish-axi` gives a browser review page, and setup installs nothing

### Requirement: Paths for check items in a repository of several packages

The skill SHALL write `paths` on a `tools.test`, `tools.lint` or `tools.build` item when the item's command covers only a part of the repository, so that `bdk check plan` hands the item only its own files (the picked tests of a test item, the changed files of a lint or build item), or runs its whole command only when one of them changed. A test or build item of a package in its own directory SHALL get `<dir>/**`. A lint item whose tool reads one file type SHALL get `<dir>/**/*.<ext>` for each extension the tool reads. When the packages share the repository root, an item SHALL get `**/*.<ext>` for the extensions of its tool's language. An item whose command holds `{files}` SHALL also get `paths` naming the files its tool reads (`**/*.<ext>` for a linter or test runner, the spec files for an E2E runner), so a changed Markdown or YAML file is never handed to it. The skill SHALL NOT write `paths` on an item whose whole command covers the whole repository, so a single-package repository gets `paths` only on its `{files}` items, and one root command that runs every package gets none.

#### Scenario: Python API and web frontend

- **WHEN** `/bdk:setup` runs in a repository with `api/` (uv, pytest, ruff) and `web/` (pnpm, vitest, eslint)
- **THEN** `.bdk/settings.yaml` gives the `pytest` items `paths` that match only files under `api/`, the `ruff` items `paths` that match only `.py` files under `api/`, and the `vitest` and `eslint` items `paths` that match only files under `web/`
- **AND** `bdk check plan <run-dir> <stage> --at part --scope web/src/a.tsx --tests web/src/a.test.tsx` plans only the `web` items and lists the `api` items as skipped

#### Scenario: Single package

- **WHEN** `/bdk:setup` runs in a repository with one `package.json` at its root
- **THEN** no check item whose command lacks `{files}` has `paths`

### Requirement: Project map block

The `bdk` plugin SHALL ship the block `explore-project` (`/bdk:explore-project`), which runs on the agent `bdk:explorer` and maps how a project builds, tests, lints and runs. It SHALL work in a project with or without a BDK configuration, and SHALL change no file but its map, `.bdk/runs/setup/project-map.md`, which it rewrites on every run. The map SHALL hold the sections `## Rules`, `## Packages`, `## Tests`, `## Lint and build`, `## Run`, `## CI` and `## Unsure`, and every fact SHALL name the `file:line` it was read at. Its brief SHALL name what to find and SHALL NOT assume a language, framework or test tool; it SHALL cover:

- the project's rules on running its commands: `CLAUDE.md`, `AGENTS.md`, `.claude/rules/`, and the hooks of `.claude/settings.json` with the scripts they call and the commands they block;
- every manifest and task file at any depth (outside dependency and build folders), with its language and the package manager or build tool that runs it;
- every test and E2E suite: its runner and config, the script or wrapper the project runs it through and whether the wrapper passes extra arguments to the runner, the setup that starts its own server or services (a global setup, a fixture, a container) with the command, port and environment it uses, where its test files are, and the rules that say when to run it;
- the lint, format, type and build commands, the folders a tool skips, and every script with a side effect beyond the check (a deploy, a publish, a migration, a network call needing secrets);
- how a user starts the product locally and what that start needs (a cloud deployment, secrets, a service);
- the CI workflows and the commands they run.

When a user types the command in the main thread, the skill SHALL start the `bdk:explorer` agent with `model` and `effort` from `models.explorer` when the configuration sets them, wait for it, and reply with its result.

#### Scenario: Map of a project with a wrapper and a hook

- **WHEN** `/bdk:explore-project` runs in a project whose `test:e2e` script runs `scripts/run-e2e.sh`, whose Playwright config has a `globalSetup` that starts the server and no `webServer`, whose `.claude/settings.json` holds a hook that blocks a direct `playwright test`, and whose `build` script deploys
- **THEN** `.bdk/runs/setup/project-map.md` names the wrapper, the global setup, the hook and the deploying `build`, each with a `file:line`

#### Scenario: Project without BDK

- **WHEN** `/bdk:explore-project` runs in a project without `.bdk/settings.yaml`
- **THEN** it writes the map and writes no other file

### Requirement: Setup maps the project before it detects

Every `/bdk:setup` run that detects values (a first run, a re-run filling empty groups, or a re-run whose arguments name a change) SHALL first start the `bdk:explorer` agent in the foreground on the block `explore-project`, with `model` and `effort` from `models.explorer` when the configuration sets them, and SHALL read the map before it writes `.bdk/settings.yaml`. The check items, their `when`, `timeout` and `paths`, the E2E `start`, `ready` and `env`, and the report SHALL follow the map: a rule, hook or wrapper the map names SHALL decide how an item runs over the bare tool. A re-run that only fixes an invalid configuration SHALL NOT start the agent. Setup SHALL NOT run a project command (a test, lint, build, dev or install script) to try a value; the only one it runs is a Playwright install the user agreed to.

#### Scenario: Explorer started before the settings are written

- **WHEN** `/bdk:setup` runs in a project without `.bdk/settings.yaml`
- **THEN** a `bdk:explorer` agent runs `explore-project` and writes `.bdk/runs/setup/project-map.md` before setup writes `.bdk/settings.yaml`

#### Scenario: No project command tried

- **WHEN** `/bdk:setup` runs in a repository whose `api/` package runs `pytest` through `uv`
- **THEN** setup writes the `pytest` item without running it, and the transcript holds no Bash call of a test, lint, build or dev command

### Requirement: Setup runs on opus

The skill `setup` SHALL name `model: opus` in its frontmatter, so the main thread runs setup's decisions on `opus` whatever the session model.

#### Scenario: Skill frontmatter

- **WHEN** `plugins/bdk/skills/setup/SKILL.md` is read
- **THEN** its frontmatter holds `model: opus`

### Requirement: Report every left-out tool

The report SHALL hold one line for every test, lint, format, type, build or E2E tool the map or the project files name that setup writes no item for, giving the tool, the file that shows it and the reason (for example: a load test that needs a running server, a visual test that needs a secret token, a `build` script that deploys). A tool that runs only inside another item (a runner behind its wrapper) SHALL be named with the item that runs it. Setup SHALL record a left-out tool only in the report, not in `.bdk/settings.yaml`.

#### Scenario: Deploying build left out

- **WHEN** the project's `build` script runs `next build` and then a deploy script
- **THEN** no check item runs that script, and the report names it with the reason that it deploys

#### Scenario: A tool that needs a secret

- **WHEN** the project has a `test:visual` script running `chromatic`, which needs a project token
- **THEN** no check item runs it, and the report names `chromatic` with the reason

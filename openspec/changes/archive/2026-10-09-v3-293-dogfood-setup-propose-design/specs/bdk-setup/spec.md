## MODIFIED Requirements

### Requirement: E2E entry by product kind

The skill SHALL write one `tools.e2e` item per runnable product of the project, classified by what a user runs:

| Product | `id` | `driver` | `start` | `ready` |
|---|---|---|---|---|
| web app (a UI framework or bundler, or an end-to-end browser test config) | `web` | `browser` | the Playwright `webServer.command` when present, else the dev script (`dev`, then `start`) through the package manager | the Playwright `webServer.url` when present, else `http://localhost:<port>` with the port from the script, the framework config or the framework default |
| HTTP API (a server framework and no UI) | `api` | `http` | the start script or the framework's run command | `http://localhost:<port>` followed by the health route when the code has one, else `/` |
| Claude Code plugin (a `.claude-plugin/plugin.json`) | `plugin` | `cli` | the build command that makes the plugin loadable, else the same command as `ready` | `claude plugin validate <plugin dir>` |
| CLI (a `bin` entry, `[project.scripts]`, a Go `main` package without a server, a Rust binary) | `cli` | `cli` | the build command that makes the binary runnable, else the same command as `ready` | the CLI's help invocation |

A Claude Code plugin SHALL be classified as a plugin even when it also ships a `bin` entry: its user runs its skills and hooks in a Claude Code session, not the binary. Several products in one workspace SHALL get one item each, the `id` suffixed with the package name. A project with no runnable product SHALL get no `tools.e2e` item, and the report SHALL say that E2E is skipped and why. `env` SHALL be written only for a variable the start command needs, with a non-secret local value the project documents. `browser` SHALL NOT be written: the tester then uses `playwright`, and a user who wants `chrome-devtools-mcp` sets it.

#### Scenario: Web app with Playwright

- **WHEN** the project has `vite` and `react` dependencies and a `playwright.config.ts` whose `webServer` has `command: "pnpm dev"` and `url: "http://localhost:5173"`
- **THEN** `.bdk/settings.yaml` holds a `tools.e2e` item `web` with `driver: browser`, `start: pnpm dev` and `ready: http://localhost:5173`

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

### Requirement: Ask only what the files cannot answer

The skill SHALL detect everything before it writes, and SHALL ask the user at most one round of questions, only for what the project files leave open: competing commands for a group, a group without a command, an E2E start command or port the files do not settle, an existing `openspec/config.yaml` naming a schema other than `bdk` ("OpenSpec with the BDK schema"), deleting v2 files, and installing Playwright for a `browser` item ("Playwright for the browser item"). Each question SHALL put the recommended answer first. When nothing is open, it SHALL ask nothing. When it cannot ask, it SHALL take the recommended answers and name them in the report, except that it SHALL NOT delete files and SHALL NOT install anything without an answer.

#### Scenario: Nothing to ask

- **WHEN** every group has exactly one detected command, the E2E entry is fully detected, the web app has Playwright and a browser for it, and the project has no `openspec/` yet
- **THEN** setup writes the configuration without asking a question

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

The skill SHALL make `.gitignore` hold `/.bdk/runs/` and `/.bdk/settings.local.yaml`, adding each one that is missing. When `.bdk/settings.yaml` is ignored by a rule of the project (the v2 `/.bdk/` rule), it SHALL replace that rule with those two paths, so the project layer is committed, and the report SHALL name the removed rule, the file it was in and why in a line of its own. A v2 `.bdk/settings.json` SHALL be read as detection hints, and the v2 paths SHALL be deleted only after the user agrees.

#### Scenario: v2 ignore rule replaced

- **WHEN** `.gitignore` holds `/.bdk/` from BDK v2
- **THEN** after setup `git check-ignore .bdk/settings.yaml` exits 1, `git check-ignore .bdk/runs/x` exits 0, and the report names the removed `/.bdk/` rule of `.gitignore` and says that `.bdk/settings.yaml` is now tracked

### Requirement: Eval cases

The `bdk` eval suite SHALL hold `block` cases for the skill: `setup-web-app`, `setup-web-no-playwright`, `setup-http-api`, `setup-node-cli`, `setup-claude-plugin`, `setup-library`, `setup-multi-package` and `setup-existing-openspec`, at least one per product kind of "E2E entry by product kind", each grading the written `.bdk/settings.yaml` and `openspec/config.yaml`, the installed schema, the permission rules in the reply (Claude Code refuses a write to `.claude/settings.json` in an eval run) and that the skill fired. The two web cases SHALL also grade how the reply says Playwright will run. `setup-web-app` SHALL also put a `lavish-axi` stand-in that answers `--version` into the workspace and grade that the reply reports the Lavish page; `setup-library` SHALL put a stand-in that fails into the workspace and grade that the reply reports `AskUserQuestion` and suggests installing `lavish-axi`. `setup-multi-package` SHALL run on a fixture with `api/` and `web/` packages and grade that each check item's `paths` cover only its package; `setup-web-app` SHALL grade that no check item has `paths`. `setup-existing-openspec` SHALL start from a project with `schema: spec-driven` and the v2 `/.bdk/` ignore rule, and grade that the schema line is kept and that the reply names the removed rule.

#### Scenario: Cases load in CI

- **WHEN** `pnpm test` runs the free eval check
- **THEN** the eight `setup-*` cases load with no error at zero cost

#### Scenario: Both decision surfaces graded

- **WHEN** the `setup-*` cases run
- **THEN** `setup-web-app` grades the Lavish line of the report and `setup-library` grades the `AskUserQuestion` line

#### Scenario: Multi-package paths graded

- **WHEN** `setup-multi-package` runs
- **THEN** it grades that the `api` items' `paths` match no `web/` file and the `web` items' `paths` match no `api/` file

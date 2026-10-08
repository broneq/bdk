## MODIFIED Requirements

### Requirement: E2E entry by product kind

The skill SHALL write one `tools.e2e` item per runnable product of the project, classified by what a user runs:

| Product | `id` | `driver` | `start` | `ready` |
|---|---|---|---|---|
| web app (a UI framework or bundler, or an end-to-end browser test config) | `web` | `browser` | the Playwright `webServer.command` when present, else the dev script (`dev`, then `start`) through the package manager | the Playwright `webServer.url` when present, else `http://localhost:<port>` with the port from the script, the framework config or the framework default |
| HTTP API (a server framework and no UI) | `api` | `http` | the start script or the framework's run command | `http://localhost:<port>` followed by the health route when the code has one, else `/` |
| CLI (a `bin` entry, `[project.scripts]`, a Go `main` package without a server, a Rust binary) | `cli` | `cli` | the build command that makes the binary runnable, else the same command as `ready` | the CLI's help invocation |

Several products in one workspace SHALL get one item each, the `id` suffixed with the package name. A project with no runnable product SHALL get no `tools.e2e` item, and the report SHALL say that E2E is skipped and why. `env` SHALL be written only for a variable the start command needs, with a non-secret local value the project documents. `browser` SHALL NOT be written: the tester then uses `playwright`, and a user who wants `chrome-devtools-mcp` sets it.

#### Scenario: Web app with Playwright

- **WHEN** the project has `vite` and `react` dependencies and a `playwright.config.ts` whose `webServer` has `command: "pnpm dev"` and `url: "http://localhost:5173"`
- **THEN** `.bdk/settings.yaml` holds a `tools.e2e` item `web` with `driver: browser`, `start: pnpm dev` and `ready: http://localhost:5173`

#### Scenario: HTTP API

- **WHEN** the project is an Express server listening on port 4000 with a `/health` route and a `start` script
- **THEN** `.bdk/settings.yaml` holds a `tools.e2e` item `api` with `driver: http` and `ready: http://localhost:4000/health`

#### Scenario: CLI

- **WHEN** `package.json` declares `"bin": {"ledger": "bin/ledger.js"}` and the project starts no server
- **THEN** `.bdk/settings.yaml` holds a `tools.e2e` item `cli` with `driver: cli` and a `ready` command that runs the CLI with `--help`

#### Scenario: Library

- **WHEN** the project exports functions and has no UI, server or `bin`
- **THEN** `.bdk/settings.yaml` holds no `tools.e2e` item and the report says E2E is skipped because there is nothing to run

#### Scenario: Chrome DevTools MCP server configured

- **WHEN** a web app's `.mcp.json` declares a server running `npx chrome-devtools-mcp@latest`
- **THEN** its `tools.e2e` item `web` holds no `browser` field, and the report says the tester uses Playwright and that `browser: chrome-devtools-mcp` selects the server

### Requirement: Eval cases

The `bdk` eval suite SHALL hold `block` cases for the skill: `setup-web-app`, `setup-web-no-playwright`, `setup-http-api`, `setup-node-cli` and `setup-library`, at least one per product kind of "E2E entry by product kind", each grading the written `.bdk/settings.yaml` and `openspec/config.yaml`, the installed schema, the permission rules in the reply (Claude Code refuses a write to `.claude/settings.json` in an eval run) and that the skill fired. The two web cases SHALL also grade how the reply says Playwright will run.

#### Scenario: Cases load in CI

- **WHEN** `pnpm test` runs the free eval check
- **THEN** the five `setup-*` cases load with no error at zero cost

### Requirement: Ask only what the files cannot answer

The skill SHALL detect everything before it writes, and SHALL ask the user at most one round of questions, only for what the project files leave open: competing commands for a group, a group without a command, an E2E start command or port the files do not settle, a foreign OpenSpec schema, deleting v2 files, and installing Playwright for a `browser` item ("Playwright for the browser item"). Each question SHALL put the recommended answer first. When nothing is open, it SHALL ask nothing. When it cannot ask, it SHALL take the recommended answers and name them in the report, except that it SHALL NOT delete files and SHALL NOT install anything without an answer.

#### Scenario: Nothing to ask

- **WHEN** every group has exactly one detected command, the E2E entry is fully detected, and the web app has Playwright and a browser for it
- **THEN** setup writes the configuration without asking a question

## ADDED Requirements

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

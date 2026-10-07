## MODIFIED Requirements

### Requirement: E2E entry by product kind

The skill SHALL write one `tools.e2e` item per runnable product of the project, classified by what a user runs:

| Product | `id` | `driver` | `start` | `ready` |
|---|---|---|---|---|
| web app (a UI framework or bundler, or an end-to-end browser test config) | `web` | `browser` | the Playwright `webServer.command` when present, else the dev script (`dev`, then `start`) through the package manager | the Playwright `webServer.url` when present, else `http://localhost:<port>` with the port from the script, the framework config or the framework default |
| HTTP API (a server framework and no UI) | `api` | `http` | the start script or the framework's run command | `http://localhost:<port>` followed by the health route when the code has one, else `/` |
| CLI (a `bin` entry, `[project.scripts]`, a Go `main` package without a server, a Rust binary) | `cli` | `cli` | the build command that makes the binary runnable, else the same command as `ready` | the CLI's help invocation |

Several products in one workspace SHALL get one item each, the `id` suffixed with the package name. A project with no runnable product SHALL get no `tools.e2e` item, and the report SHALL say that E2E is skipped and why. `env` SHALL be written only for a variable the start command needs, with a non-secret local value the project documents. `browser` SHALL be written, as `chrome-devtools-mcp`, only on a `browser` item of a project whose `.mcp.json` declares a Chrome DevTools MCP server (a server running the `chrome-devtools-mcp` package); otherwise it SHALL be left out, so the tester uses `chrome-devtools-axi`.

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
- **THEN** its `tools.e2e` item `web` holds `browser: chrome-devtools-mcp`, and a web app without that server gets no `browser` field

# E2E entries

`tools.e2e` tells the E2E check how to start the product and when it is ready; the tester then drives it as a user would. Write one item per runnable product: `id`, `start` (a command), `ready` (a URL, or a command that exits 0 once the product runs), `driver` (`browser`, `http` or `cli`), `browser` and `env` only when needed.

## Classify by what a user runs

| Kind | Signals | `id`, `driver` |
|---|---|---|
| Web app | a UI framework or bundler dependency (`vite`, `next`, `react-scripts`, `@angular/core`, `nuxt`, `@sveltejs/kit`, `astro`), or an `index.html` a dev script serves; a Playwright or Cypress config | `web`, `browser` |
| HTTP API | a server framework (`express`, `fastify`, `koa`, `hono`, `@nestjs/core`; `fastapi`, `flask`, `django`; Go `net/http` or a router in a `main` package; Spring Boot; Rails) and no UI | `api`, `http` |
| Claude Code plugin | `.claude-plugin/plugin.json` in the package, also with a `bin/` or `package.json` `bin` | `plugin`, `cli` |
| CLI | `package.json` `bin`; `[project.scripts]` in `pyproject.toml`; a Go `main` package that serves nothing; `[[bin]]` or `src/main.rs` in `Cargo.toml` | `cli`, `cli` |
| Library | none of the above: exported code only | no item |

Check the rows top down; the first that matches wins. A plugin's `bin/` launcher is not a product of its own: its user runs the plugin's skills and hooks in a Claude Code session. A `.claude-plugin/marketplace.json` alone only lists plugins: classify each plugin directory it names. A web UI that serves its own API in one process is one `web` item. A workspace with several products gets one item each, the `id` suffixed with the package name (`web-admin`, `api-billing`).

## Web app

- `start`: a Playwright `webServer.command` (or Cypress `baseUrl` with its dev script) when present; else the `dev` script, then `start`, through the package manager (`pnpm dev`).
- `ready`: the Playwright `webServer.url` (or `use.baseURL`) when present; else `http://localhost:<port>`, the port from the script's `--port`, then the framework config (`server.port` in `vite.config.*`), then the default: Vite and SvelteKit 5173, Next and Nuxt 3000, Create React App 3000, Angular 4200, Astro 4321.

## HTTP API

- `start`: the `start` script, else `dev`, through the package manager; else the framework's run command (`uvicorn <module>:app --port <port>`, `flask --app <module> run --port <port>`, `python manage.py runserver <port>`, `go run .`, `./gradlew bootRun`, `bin/rails server`).
- `ready`: `http://localhost:<port><path>`. The port from code (`listen(4000)`, `PORT ?? 4000`) or configuration (`.env.example`, `application.properties`), else the framework default (Express and Node servers 3000, FastAPI with uvicorn 8000, Flask 5000, Django 8000, Spring Boot 8080, Rails 3000). The path is a health route the code defines (`/health`, `/healthz`, `/status`, `/ping`), else `/`.

## Claude Code plugin

- `ready`: `claude plugin validate <plugin dir>` (`.` at the repository root), which exits 0 when the manifest, skills, agents and hooks load.
- `start`: the build command that makes the plugin loadable (`pnpm build` when hooks or `bin/` run built files under `dist/`); with no build, the same command as `ready`.
- The E2E tester drives each scenario as a session: `claude -p "<what the user types>" --plugin-dir <absolute plugin dir>` in a scratch directory. Say in the report that every driven scenario is one model call on the user's account.

## CLI

- `ready`: the CLI's help invocation, which exits 0 once it runs: `node bin/<name>.js --help`, `uv run <script> --help`, `go run ./cmd/<name> --help`, `cargo run --quiet -- --help`.
- `start`: the build command that makes it runnable (`pnpm build`, `go build ./...`, `cargo build`); for an interpreted CLI with no build, the same command as `ready`.

## `browser`

Never write it. The E2E tester then drives the browser with Playwright; a user who wants the Chrome DevTools MCP server sets `browser: chrome-devtools-mcp` themselves. When the project's `.mcp.json` declares a server running the `chrome-devtools-mcp` package, say that in the report.

## Playwright

For each `browser` item, the E2E tester runs Playwright: the project's own `@playwright/test` or `playwright` when it resolves from the web app's package, else Playwright 1.63.0 it installs for each run into a scratch directory. It launches the Chromium Playwright installed, else the system Chrome.

Detect, in step 2, whatever the user later answers (the report needs both):

- Project Playwright: `@playwright/test` or `playwright` in `dependencies` or `devDependencies` of the web app's `package.json`.
- A browser: run this once; it prints the Chromium builds Playwright installed and the system Chrome, if any:

  ```bash
  node -e "const fs=require('fs'),os=require('os'),path=require('path');const dir=process.env.PLAYWRIGHT_BROWSERS_PATH||path.join(os.homedir(),{darwin:'Library/Caches',linux:'.cache',win32:'AppData/Local'}[process.platform]||'.cache','ms-playwright');let builds=[];try{builds=fs.readdirSync(dir).filter((n)=>/^chromium(_headless_shell)?-/.test(n))}catch{}const chrome=['/Applications/Google Chrome.app','/usr/bin/google-chrome','/usr/bin/google-chrome-stable','C:/Program Files/Google/Chrome/Application/chrome.exe'].find((f)=>fs.existsSync(f));console.log(JSON.stringify({builds,chrome:chrome||null}))"
  ```

Ask, in step 3, only when the web app's package is a Node package (it has a `package.json`) and it has no Playwright, or no build and no Chrome were found: "Install Playwright for the E2E tester?", recommended first "Install @playwright/test 1.63.0 (and Chromium)", second "Do not install; the tester installs Playwright for each run". Among the E2E questions this one goes first. A web app without `package.json` (Django templates, Rails) gets no question: the tester's own install covers it.

Install, in step 9, after a yes, with the package manager of the lockfile, in the web app's package:

| Package manager | Add the package | Install Chromium (when no build was found) |
|---|---|---|
| pnpm | `pnpm add -D @playwright/test@1.63.0` (workspace: `pnpm --filter <package> add -D @playwright/test@1.63.0`) | `pnpm exec playwright install chromium` (workspace: `pnpm --filter <package> exec playwright install chromium`) |
| npm | `npm install -D @playwright/test@1.63.0` (workspace: `npm install -D @playwright/test@1.63.0 -w <package>`) | `npx playwright install chromium` |
| yarn | `yarn add -D @playwright/test@1.63.0` (workspace: `yarn workspace <package> add -D @playwright/test@1.63.0`) | `yarn playwright install chromium` |
| bun | `bun add -d @playwright/test@1.63.0` (workspace: `bun add -d @playwright/test@1.63.0 --cwd <dir>`) | `bunx playwright install chromium` |

When the project has Playwright and only the browser is missing, ask the same question and run only the second column. Check with `node -e "console.log(require.resolve('@playwright/test', {paths: ['<package dir>']}))"`.

Report one line per `browser` item:

- `E2E browser: the project's Playwright (@playwright/test <version>)`, when it has or now has it; add `run <pm> install first` when it is declared but does not resolve yet;
- `E2E browser: Playwright 1.63.0 installed by the tester for each run; to use your own, <the add command>`, when it has none;
- and, when no build and no Chrome were found and nothing installed one: `no browser found: npx -y playwright@1.63.0 install chromium`.

## `env`

Only a variable the start command needs that the project documents (`.env.example`, README) with a safe local value, such as `PORT: "4000"`. Never write a secret, token or password; name the variable in the report instead.

## When to ask

Ask (step 3 of the skill) only when two candidates compete for `start`, or when the port is a framework default and the code or config suggests another one. The Playwright question is in [Playwright](#playwright). A library is not a question: report "E2E skipped: the project has nothing to run (no UI, server or CLI)".

# E2E entries

`tools.e2e` tells the E2E check how to start the product and when it is ready; the tester then drives it as a user would. Write one item per runnable product: `id`, `start` (a command), `ready` (a URL, or a command that exits 0 once the product runs), `driver` (`browser`, `http` or `cli`), `browser` and `env` only when needed.

## Classify by what a user runs

| Kind | Signals | `id`, `driver` |
|---|---|---|
| Web app | a UI framework or bundler dependency (`vite`, `next`, `react-scripts`, `@angular/core`, `nuxt`, `@sveltejs/kit`, `astro`), or an `index.html` a dev script serves; a Playwright or Cypress config | `web`, `browser` |
| HTTP API | a server framework (`express`, `fastify`, `koa`, `hono`, `@nestjs/core`; `fastapi`, `flask`, `django`; Go `net/http` or a router in a `main` package; Spring Boot; Rails) and no UI | `api`, `http` |
| CLI | `package.json` `bin`; `[project.scripts]` in `pyproject.toml`; a Go `main` package that serves nothing; `[[bin]]` or `src/main.rs` in `Cargo.toml` | `cli`, `cli` |
| Library | none of the above: exported code only | no item |

A web UI that serves its own API in one process is one `web` item. A workspace with several products gets one item each, the `id` suffixed with the package name (`web-admin`, `api-billing`).

## Web app

- `start`: a Playwright `webServer.command` (or Cypress `baseUrl` with its dev script) when present; else the `dev` script, then `start`, through the package manager (`pnpm dev`).
- `ready`: the Playwright `webServer.url` (or `use.baseURL`) when present; else `http://localhost:<port>`, the port from the script's `--port`, then the framework config (`server.port` in `vite.config.*`), then the default: Vite and SvelteKit 5173, Next and Nuxt 3000, Create React App 3000, Angular 4200, Astro 4321.

## HTTP API

- `start`: the `start` script, else `dev`, through the package manager; else the framework's run command (`uvicorn <module>:app --port <port>`, `flask --app <module> run --port <port>`, `python manage.py runserver <port>`, `go run .`, `./gradlew bootRun`, `bin/rails server`).
- `ready`: `http://localhost:<port><path>`. The port from code (`listen(4000)`, `PORT ?? 4000`) or configuration (`.env.example`, `application.properties`), else the framework default (Express and Node servers 3000, FastAPI with uvicorn 8000, Flask 5000, Django 8000, Spring Boot 8080, Rails 3000). The path is a health route the code defines (`/health`, `/healthz`, `/status`, `/ping`), else `/`.

## CLI

- `ready`: the CLI's help invocation, which exits 0 once it runs: `node bin/<name>.js --help`, `uv run <script> --help`, `go run ./cmd/<name> --help`, `cargo run --quiet -- --help`.
- `start`: the build command that makes it runnable (`pnpm build`, `go build ./...`, `cargo build`); for an interpreted CLI with no build, the same command as `ready`.

## `browser`

Only on a `browser` item, and only as `browser: chrome-devtools-mcp`, when the project's `.mcp.json` declares a server that runs the `chrome-devtools-mcp` package. Otherwise leave it out: the E2E tester then uses `chrome-devtools-axi` through `npx`.

## `env`

Only a variable the start command needs that the project documents (`.env.example`, README) with a safe local value, such as `PORT: "4000"`. Never write a secret, token or password; name the variable in the report instead.

## When to ask

Ask (step 3 of the skill) only when two candidates compete for `start`, or when the port is a framework default and the code or config suggests another one. A library is not a question: report "E2E skipped: the project has nothing to run (no UI, server or CLI)".

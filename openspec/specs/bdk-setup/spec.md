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

The skill SHALL detect `languages` and the `tools.test`, `tools.lint` and `tools.build` items from the project's files, preferring the project's own scripts run through the package manager its lockfile names over direct tool calls. Each item SHALL have a kebab-case `id` naming the runner or checker (never the package manager), the full `command`, and a `scoped` form holding `{files}` only where the runner takes a list of files. It SHALL write only detected keys to `.bdk/settings.yaml` and leave every other key on its default.

#### Scenario: Scripts through the package manager

- **WHEN** the project has `pnpm-lock.yaml` and a `package.json` script `test` running `vitest run`
- **THEN** `.bdk/settings.yaml` holds a `tools.test` item `vitest` with `command: pnpm test` and a `scoped` form containing `{files}`

#### Scenario: Defaults stay out of the file

- **WHEN** setup writes a fresh `.bdk/settings.yaml`
- **THEN** the file holds no `policy`, `plan`, `execution` or `hooks` key

### Requirement: E2E entry by product kind

The skill SHALL write one `tools.e2e` item per runnable product of the project, classified by what a user runs:

| Product | `id` | `driver` | `start` | `ready` |
|---|---|---|---|---|
| web app (a UI framework or bundler, or an end-to-end browser test config) | `web` | `browser` | the Playwright `webServer.command` when present, else the dev script (`dev`, then `start`) through the package manager | the Playwright `webServer.url` when present, else `http://localhost:<port>` with the port from the script, the framework config or the framework default |
| HTTP API (a server framework and no UI) | `api` | `http` | the start script or the framework's run command | `http://localhost:<port>` followed by the health route when the code has one, else `/` |
| CLI (a `bin` entry, `[project.scripts]`, a Go `main` package without a server, a Rust binary) | `cli` | `cli` | the build command that makes the binary runnable, else the same command as `ready` | the CLI's help invocation |

Several products in one workspace SHALL get one item each, the `id` suffixed with the package name. A project with no runnable product SHALL get no `tools.e2e` item, and the report SHALL say that E2E is skipped and why. `env` SHALL be written only for a variable the start command needs, with a non-secret local value the project documents.

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

### Requirement: Ask only what the files cannot answer

The skill SHALL detect everything before it writes, and SHALL ask the user at most one round of questions, only for what the project files leave open: competing commands for a group, a group without a command, an E2E start command or port the files do not settle, a foreign OpenSpec schema, and deleting v2 files. Each question SHALL put the recommended answer first. When nothing is open, it SHALL ask nothing. When it cannot ask, it SHALL take the recommended answers and name them in the report, except that it SHALL NOT delete files without an answer.

#### Scenario: Nothing to ask

- **WHEN** every group has exactly one detected command and the E2E entry is fully detected
- **THEN** setup writes the configuration without asking a question

### Requirement: Permission allow rules

The skill SHALL add to `permissions.allow` of the project's `.claude/settings.json` each of these rules that is missing, keeping every existing entry and key of the file: `Bash(bdk *)`, `Bash(*/bin/bdk *)`, `Bash(openspec *)`, `Bash(git *)`, `Bash(gh *)`, `Bash(<command>)` for every `tools.test`, `tools.lint` and `tools.build` command and every `tools.e2e` `start` or command `ready`, and `Bash(<prefix> *)` for every `scoped` form, where `<prefix>` is the command before `{files}`. Claude Code asks the user to approve a write to `.claude/settings.json`; when the write is refused, the report SHALL list the rules for the user to add.

#### Scenario: Rules merged into existing settings

- **WHEN** `.claude/settings.json` already allows `Read` and sets `model`
- **THEN** after setup the file still allows `Read`, still sets `model`, and also allows `Bash(bdk *)`, `Bash(git *)`, `Bash(gh *)` and the detected test command

### Requirement: OpenSpec with the BDK schema

The skill SHALL initialise OpenSpec when the project has no `openspec/`, with OpenSpec 1.13.2 and no tool integration (`openspec init --tools none`), using `npx -y @fission-ai/openspec@1.13.2` when the installed `openspec` is missing or another version. When no OpenSpec CLI can run, it SHALL write the layout `openspec init` writes (`openspec/config.yaml`, `openspec/specs/`, `openspec/changes/archive/`) and the report SHALL tell the user to install OpenSpec 1.13.2. It SHALL install the plugin's `openspec/schemas/bdk/` into `openspec/schemas/bdk/` of the project with `bdk openspec install` on every run and set `schema: bdk` in `openspec/config.yaml`, keeping the rest of that file.

#### Scenario: Schema installed and default

- **WHEN** setup has run in a project without `openspec/` and the OpenSpec CLI is available
- **THEN** `openspec/schemas/bdk/schema.yaml` exists, `openspec/config.yaml` sets `schema: bdk`, and `openspec schema which bdk` reports the project as its source

#### Scenario: Existing OpenSpec project

- **WHEN** the project already has `openspec/` with `schema: spec-driven` and its own specs
- **THEN** setup does not run `openspec init`, keeps the specs, installs the BDK schema and sets `schema: bdk`

### Requirement: Git ignore rules and v2 projects

The skill SHALL make `.gitignore` hold `/.bdk/runs/` and `/.bdk/settings.local.yaml`, adding each one that is missing. When `.bdk/settings.yaml` is ignored by a rule of the project (the v2 `/.bdk/` rule), it SHALL replace that rule with those two paths, so the project layer is committed. A v2 `.bdk/settings.json` SHALL be read as detection hints, and the v2 paths SHALL be deleted only after the user agrees.

#### Scenario: v2 ignore rule replaced

- **WHEN** `.gitignore` holds `/.bdk/` from BDK v2
- **THEN** after setup `git check-ignore .bdk/settings.yaml` exits 1 and `git check-ignore .bdk/runs/x` exits 0

### Requirement: Re-run keeps the project's choices

When the project is already configured, the skill SHALL keep every value a layer sets, change only what the user's arguments ask for or what `bdk config check` reports as a problem, add only missing rules and ignore entries, and copy the BDK schema again. Edits to `.bdk/settings.yaml` SHALL keep its comments and key order.

#### Scenario: Targeted re-run

- **WHEN** `/bdk:setup add the e2e entry` runs in a configured project with a comment in `.bdk/settings.yaml`
- **THEN** only `tools.e2e` changes in that file and the comment is still there

### Requirement: Eval cases

The `bdk` eval suite SHALL hold `block` cases for the skill: `setup-web-app`, `setup-http-api`, `setup-node-cli` and `setup-library`, one per product kind of "E2E entry by product kind", each grading the written `.bdk/settings.yaml` and `openspec/config.yaml`, the installed schema, the permission rules in the reply (Claude Code refuses a write to `.claude/settings.json` in an eval run) and that the skill fired.

#### Scenario: Cases load in CI

- **WHEN** `pnpm test` runs the free eval check
- **THEN** the four `setup-*` cases load with no error at zero cost

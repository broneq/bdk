---
name: explore-project
description: 'Maps how a project builds, tests, lints and runs - its rules and hooks, manifests, test and E2E suites with their wrappers and server setup, side effects, CI - each fact with file:line, into the run file .bdk/runs/setup/project-map.md, on the bdk:explorer agent. Any stack. Use when /bdk:setup needs the map, or when asked how a project runs its checks before configuring tooling.'
allowed-tools: Bash(${CLAUDE_PLUGIN_ROOT}/bin/bdk *) Bash(git log *) Bash(git ls-files *) Read Grep Glob Write Agent
---

Current BDK configuration of this project (a project without one is fine here):

!`"${CLAUDE_PLUGIN_ROOT}/bin/bdk" config show`

# Explore the project

Write one map of how this project runs its checks and its product, so a caller can configure them without guessing. Assume nothing about the stack: a project mixes languages and tools freely (a Java build with a Node E2E suite in a sub-folder, a Node app tested with pytest). Find every fact below by searching, never by inferring it from the first manifest you see.

## 0. Run as `bdk:explorer`

This block runs on the `bdk:explorer` agent, whose instructions start with "You are `bdk:explorer`". When you are not that agent (a user typed the command in the main thread), do not map the project yourself: start the agent with the Agent tool in the foreground (`run_in_background: false`), `subagent_type: "bdk:explorer"`, prompt `Run the skill bdk:explore-project`, `model` set to `models.explorer.model` and `effort` set to `models.explorer.effort`, each only when the configuration above sets it; wait for it, reply with its answer, and stop.

Done when you are `bdk:explorer`, or the agent has answered.

## 1. Find the files

List what the project holds before reading any of it. Use Glob and `git ls-files` (it skips ignored folders); leave out dependency and build output (`node_modules/`, `vendor/`, `target/`, `build/`, `dist/`, `.venv/`). Look at any depth for:

- rules: `CLAUDE.md`, `AGENTS.md`, `.claude/rules/**`, `.claude/settings.json` and `.claude/settings.local.json` (their `hooks` and the scripts those run), `CONTRIBUTING.md`, the README sections on develop, test and run;
- manifests and task files: `package.json`, `pyproject.toml`, `setup.cfg`, `tox.ini`, `noxfile.py`, `pom.xml`, `build.gradle*`, `go.mod`, `Cargo.toml`, `Gemfile`, `composer.json`, `*.csproj`, `Makefile`, `justfile`, `Taskfile.yml`, and lockfiles;
- scripts: the files in the folders named `scripts`, `bin` and `tools`, and any `*.sh` next to a manifest;
- test and E2E configs: `playwright.config.*`, `cypress.config.*`, `vitest.config.*`, `jest.config.*`, `pytest.ini`, `conftest.py`, `karma.conf.*`, `wdio.conf.*`, a Testcontainers or `docker-compose*.yml` file the tests use, Maven surefire or failsafe sections, Gradle test tasks;
- lint, format and type configs, with their ignore lists (`eslint.config.*`, `.eslintignore`, `ruff.toml`, `.prettierignore`, `checkstyle.xml`, `.golangci.*`, `tsconfig*.json`);
- CI: `.github/workflows/*`, `.gitlab-ci.yml`, `Jenkinsfile`, `azure-pipelines.yml`, `.circleci/config.yml`, `bitbucket-pipelines.yml`.

Done when you have the list of files to read for each section of step 2.

## 2. Read and follow

Read with `Read`, `Grep` and `Glob`, not with Bash; read excerpts, not whole trees. For each fact note the `file:line` you read it at.

- **Rules.** Every line of the rules that says how, when or when not to run a command (a test, a suite, the build, the dev server), and every hook: what it matches and what it blocks or changes.
- **Packages.** Each manifest's directory, language, and the package manager or build tool that runs it (from the lockfile or wrapper: `pnpm-lock.yaml`, `uv.lock`, `mvnw`, `gradlew`).
- **Tests.** For each suite: the script the project runs it with; follow that script to the file it calls until you reach the runner. A script that starts the runner with something around it (a time budget, a server, a container, an environment, a retry) is a wrapper: name it, what it adds, its budget if any, and whether it passes extra arguments on to the runner (`"$@"`, `process.argv.slice(2)`, `%*`). Read the runner's config for its test files and its setup: a global setup, fixture or plugin hook that starts a server or service, with the command, port, profile and environment it uses; a `webServer` entry. Name a rule that says when to run the suite (a heavy suite for some changes).
- **Lint and build.** The lint, format check, type check and build commands, the folders each tool skips, and every script with a side effect beyond checking: a deploy, a publish, a migration, a call that needs secrets or the network.
- **Run.** How a user starts the product locally (`dev`, `start`, `bootRun`, `runserver`), the port, and what that start needs (a cloud deployment, secrets, a database server); and whether a test setup starts the same product locally without those.
- **CI.** Each workflow's check commands, in order.

Done when every test and E2E suite you found is followed to its runner and its server setup, or marked unsure.

## 3. Write the map

Write `.bdk/runs/setup/project-map.md` (create the directories; overwrite an earlier map) with exactly these sections:

```markdown
# Project map

## Rules
- `CLAUDE.md:3` run the E2E suite only with `pnpm test:e2e`; `.claude/hooks/e2e-guard.sh:5` blocks a direct `playwright test`.

## Packages
- `.` - TypeScript, pnpm (`pnpm-lock.yaml`); `e2e/` - JavaScript, npm (`e2e/package-lock.json`).

## Tests
- <suite: the command the project runs, the wrapper and what it adds, the runner and its config, the server setup with command, port and environment, the test files, the rule for when to run it>

## Lint and build
- <command, the folders it skips; a script with a side effect and what it does>

## Run
- <how a user starts the product, its port and what it needs; a local start a test setup uses instead>

## CI
- <workflow: its check commands>

## Unsure
- <what you could not settle, and the file that would settle it; "None." when nothing>
```

Every bullet names `file:line`. Write facts, not configuration: no `settings.yaml` values, no recommendation. Keep it under 100 lines. Write no other file.

Done when the file has the seven sections.

## 4. Reply

Reply with the path of the map and at most three lines: how many suites it found, the wrappers and hooks that change how they run, the main unsure point.

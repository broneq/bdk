## MODIFIED Requirements

### Requirement: Paths for check items in a repository of several packages

The skill SHALL write `paths` on a `tools.test`, `tools.lint` or `tools.build` item when the item's command covers only a part of the repository, so that `bdk check plan` hands the item only its own files (the picked tests of a test item, the changed files of a lint or build item), or runs its whole command only when one of them changed. A test or build item of a package in its own directory SHALL get `<dir>/**`. A lint item whose tool reads one file type SHALL get `<dir>/**/*.<ext>` for each extension the tool reads. When the packages share the repository root, an item SHALL get `**/*.<ext>` for the extensions of its tool's language. An item whose command holds `{files}` SHALL also get `paths` naming the files its tool reads (`**/*.<ext>` for a linter or test runner, the spec files for an E2E runner), so a changed Markdown or YAML file is never handed to it. The skill SHALL NOT write `paths` on an item whose whole command covers the whole repository, so a single-package repository gets `paths` only on its `{files}` items, and one root command that runs every package gets none.

#### Scenario: Python API and web frontend

- **WHEN** `/bdk:setup` runs in a repository with `api/` (uv, pytest, ruff) and `web/` (pnpm, vitest, eslint)
- **THEN** `.bdk/settings.yaml` gives the `pytest` items `paths` that match only files under `api/`, the `ruff` items `paths` that match only `.py` files under `api/`, and the `vitest` and `eslint` items `paths` that match only files under `web/`
- **AND** `bdk check plan <run-dir> <stage> --at part --scope web/src/a.tsx --tests web/src/a.test.tsx` plans only the `web` items and lists the `api` items as skipped

#### Scenario: Single package

- **WHEN** `/bdk:setup` runs in a repository with one `package.json` at its root
- **THEN** no check item whose command lacks `{files}` has `paths`

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

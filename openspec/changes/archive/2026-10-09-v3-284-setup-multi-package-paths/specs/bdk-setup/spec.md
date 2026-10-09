## ADDED Requirements

### Requirement: Paths for check items in a repository of several packages

The skill SHALL write `paths` on a `tools.test`, `tools.lint` or `tools.build` item when the item's command covers only a part of the repository, so that `bdk check run --scope` hands the item only its own files. A test or build item of a package in its own directory SHALL get `<dir>/**`. A lint item whose tool reads one file type SHALL get `<dir>/**/*.<ext>` for each extension the tool reads. When the packages share the repository root, an item SHALL get `**/*.<ext>` for the extensions of its tool's language. The skill SHALL NOT write `paths` on an item whose command covers the whole repository, so a single-package repository gets no `paths`, and one root command that runs every package gets none.

#### Scenario: Python API and web frontend

- **WHEN** `/bdk:setup` runs in a repository with `api/` (uv, pytest, ruff) and `web/` (pnpm, vitest, eslint)
- **THEN** `.bdk/settings.yaml` gives the `pytest` item a `paths` that match only files under `api/`, the `ruff` item a `paths` that match only `.py` files under `api/`, and the `vitest` and `eslint` items a `paths` that match only files under `web/`
- **AND** `bdk check run <run-dir> <stage> --scope web/src/a.tsx` runs only the `web` items and lists the `api` items as skipped

#### Scenario: Single package

- **WHEN** `/bdk:setup` runs in a repository with one `package.json` at its root
- **THEN** no check item in `.bdk/settings.yaml` has `paths`

## MODIFIED Requirements

### Requirement: Eval cases

The `bdk` eval suite SHALL hold `block` cases for the skill: `setup-web-app`, `setup-web-no-playwright`, `setup-http-api`, `setup-node-cli`, `setup-library` and `setup-multi-package`, at least one per product kind of "E2E entry by product kind", each grading the written `.bdk/settings.yaml` and `openspec/config.yaml`, the installed schema, the permission rules in the reply (Claude Code refuses a write to `.claude/settings.json` in an eval run) and that the skill fired. The two web cases SHALL also grade how the reply says Playwright will run. `setup-web-app` SHALL also put a `lavish-axi` stand-in that answers `--version` into the workspace and grade that the reply reports the Lavish page; `setup-library` SHALL put a stand-in that fails into the workspace and grade that the reply reports `AskUserQuestion` and suggests installing `lavish-axi`. `setup-multi-package` SHALL run on a fixture with `api/` and `web/` packages and grade that each check item's `paths` cover only its package; `setup-web-app` SHALL grade that no check item has `paths`.

#### Scenario: Cases load in CI

- **WHEN** `pnpm test` runs the free eval check
- **THEN** the six `setup-*` cases load with no error at zero cost

#### Scenario: Both decision surfaces graded

- **WHEN** the `setup-*` cases run
- **THEN** `setup-web-app` grades the Lavish line of the report and `setup-library` grades the `AskUserQuestion` line

#### Scenario: Multi-package paths graded

- **WHEN** `setup-multi-package` runs
- **THEN** it grades that the `api` items' `paths` match no `web/` file and the `web` items' `paths` match no `api/` file

## ADDED Requirements

### Requirement: Repository without Python

The plugin and its repository SHALL hold no Python (design "Migration (Q1)", Q1). No file under `hooks/` or `skills/` SHALL run `python3`. Git SHALL track no `.py` file, no `__pycache__` directory, no `pyproject.toml` and no `uv.lock`, and no `package.json` script SHALL run `uv`, `uvx`, `pytest` or `ruff`. Historic records (`docs/v3/`, `docs/adr/`, `openspec/changes/archive/`, `tests/fixtures/`) MAY name Python as recorded text.

#### Scenario: python3 in the plugin

- **WHEN** `grep -r python3 hooks/ skills/` runs on the tree
- **THEN** it prints nothing

#### Scenario: tracked Python files

- **WHEN** `git ls-files` is filtered for `\.py$`, `__pycache__`, `pyproject.toml` and `uv.lock`
- **THEN** the result is empty

#### Scenario: scripts without a Python tool

- **WHEN** the `scripts` of `package.json` are read
- **THEN** no script runs `uv`, `uvx`, `pytest` or `ruff`

### Requirement: Ported repository guards

The two pytest guards that protect files that still exist SHALL run as vitest tests in the `contract` project (D5, consequences: porting tests):

1. The host probe collector `tests/host-probe/collect.mjs` replaces the home directory, the project path and its encoded forms, the plugin root, the per-user Claude temp directory, the git identity and e-mail addresses with placeholders. It maps session and agent ids to stable placeholders, keeps keys, types and nesting, adds the probe metadata, and fails with the name of the check when a recording is missing.
2. A leak guard reads every JSON file under `tests/fixtures/host-payloads/` and fails on machine data: a home directory prefix, plain (`/Users/`, `/home/`) or dash-encoded (`-Users-`, `-home-`), an e-mail address, or the running user's name as a standalone token. The name inside another word (`runners`, `bdk:test-runner`) is not a finding, and neither is a name that is also a BDK role or adapter name (`runner`, the GitHub runner's user).

`agents/web-researcher.md` SHALL keep exactly the tools `WebSearch`, `WebFetch`, `Read`, `Grep` and `Glob`. A change to that set fails the plugin layout contract test until the test changes with it.

#### Scenario: a recording leaks the home directory

- **WHEN** a file under `tests/fixtures/host-payloads/` holds a path that starts with `/Users/`
- **THEN** `pnpm test:contract` fails and names the file and the match

#### Scenario: collector anonymises a payload

- **WHEN** the collector runs on a recording whose payloads hold the home directory, the project path in its encoded form and a session id
- **THEN** its output holds the placeholders instead, the same id maps to the same placeholder everywhere, and the payload keys and nesting are unchanged

#### Scenario: web-researcher gains a tool

- **WHEN** `Bash` is added to the `tools:` of `agents/web-researcher.md`
- **THEN** `pnpm test:contract` fails and names the added tool

### Requirement: Kernel test suites

The repository's tests SHALL run as the vitest projects `unit`, `e2e` and `contract`, and every test SHALL pass on the plugin as shipped. No test suite needs Python.

#### Scenario: the suites pass

- **WHEN** `pnpm test:unit`, `pnpm test:e2e` and `pnpm test:contract` run on the result
- **THEN** every test passes

## MODIFIED Requirements

### Requirement: Plugin names no removed MCP server

No file the plugin ships SHALL name the removed servers, their tools or `uvx`. The plugin ships `.claude-plugin/`, `skills/`, `agents/`, `rules/`, `hooks/`, `plugins/`, `STARTUP_INSTRUCTIONS.md`, `README.md`, the site pages under `docs/guide/` and the kernel sources under `kernel/src/`. Two exceptions name them on purpose: the removed-key registry `kernel/src/shared/config/known.ts`, so that `bdk config check` refuses `features.serena` and `features.code-review-graph` with the reason, and the kernel's tests, which use the old keys as input and the names as text that must not appear. The plugin layout contract test SHALL enforce this.

#### Scenario: repository search

- **WHEN** `git grep -E "mcp__plugin_bdk|code-review-graph|serena|uvx"` runs over the files the plugin ships, without the removed-key registry and the kernel's tests
- **THEN** it finds no match

#### Scenario: a skill names a removed tool

- **WHEN** a skill under `skills/` names `mcp__plugin_bdk_serena_find_symbol`
- **THEN** `pnpm test:contract` fails and names the file, the line and the match

#### Scenario: the removed key is refused

- **WHEN** `.bdk/settings.yaml` sets `features.serena: true`
- **THEN** `bdk config check` reports the key as a removed v2 key with its reason, and the plugin layout contract test still passes

## REMOVED Requirements

### Requirement: Unit suite green after the removal

**Reason**: Its pytest suite is gone (T32); the requirement is restated as "Kernel test suites".

**Migration**: Read "Kernel test suites".

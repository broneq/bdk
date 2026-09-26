# Spec Delta

## Purpose

Defines the BDK user documentation site: its location under `docs/`, its strict build, the guards that keep it indexed and true to the code, how pages that describe v2 are marked, and when it deploys.

## ADDED Requirements

### Requirement: Site location

The site SHALL be an MkDocs Material site configured by `mkdocs.yml` at the repository root. Its pages SHALL live in one subtree, `docs/guide/`, which is the site's `docs_dir`. Everything else under `docs/` (temporary material, task artifacts, ADRs, the `docs/v3/` archive, `HOST-FACTS.md`) SHALL stay outside the site and SHALL NOT need a nav entry. The site toolchain SHALL be the `docs` dependency group of `pyproject.toml`, locked in `uv.lock`.

#### Scenario: a temporary document is added

- **WHEN** a contributor adds a Markdown file under `docs/` outside `docs/guide/`
- **THEN** the strict build and the drift guards pass without a change to `mkdocs.yml`

### Requirement: Strict build

`mkdocs build --strict` SHALL pass on the repository. The build SHALL run through the `pnpm docs:build` script and in the docs workflow on every pull request and every push to `main`, and a warning SHALL fail it.

#### Scenario: broken link

- **WHEN** a page links to a page or anchor that does not exist
- **THEN** `pnpm docs:build` exits non-zero, and the docs workflow fails the pull request

### Requirement: Drift guards

Vitest tests in the `contract` project SHALL enforce four invariants:

1. Every user-invocable skill (`skills/*/SKILL.md` without `user-invocable: false`) is listed in `README.md` and has a `## /bdk:<name>` section in the skills reference page.
2. Every `agents/*.md` is named in the agents reference page.
3. Every page under `docs/guide/` is in the `nav` of `mkdocs.yml`, and every `nav` entry names an existing page.
4. Every repository-root `hooks/<dir>` or `hooks/<dir>/<file>` path named in the site pages, skills, rules, agents, `.claude/rules/`, `STARTUP_INSTRUCTIONS.md`, `README.md`, `CONTRIBUTING.md`, `CLAUDE.md` and `hooks/hooks.json` exists.

The guards SHALL run in `pnpm test:contract`. The pytest suite SHALL hold no docs tests.

#### Scenario: skill without a reference section

- **WHEN** a user-invocable skill is added without a section in the skills reference page
- **THEN** `pnpm test:contract` fails and names the skill

#### Scenario: page outside the nav

- **WHEN** a page is added under `docs/guide/` without a `nav` entry
- **THEN** `pnpm test:contract` fails and names the page

#### Scenario: prose names a missing hook

- **WHEN** a skill names `hooks/<dir>/<file>` and that file does not exist
- **THEN** `pnpm test:contract` fails and names the file, the line and the path

### Requirement: No pages about removed mechanisms

The site SHALL NOT describe the tool tiers, the workflow tier choice page, a BDK-bundled MCP server or the code-review-graph hooks that ADR-0001 removed. A page MAY name an MCP server only as a tool that the user installs themselves.

#### Scenario: site search after T05

- **WHEN** the pages under `docs/guide/` and `mkdocs.yml` are searched for `tool-tiers`, `tool tier`, `choosing-a-tier`, `register-graph-repo`, `.mcp.json`, and for Serena or code-review-graph named as bundled with BDK
- **THEN** there is no match

### Requirement: v2 banner

Every page that describes v2 behaviour SHALL open, directly under its title, with the same admonition. The admonition SHALL say that the page describes BDK v2 and that the v3 documentation (T50) replaces it. The snippet pages that include `CHANGELOG.md` and `CONTRIBUTING.md` SHALL carry no banner. A test SHALL enforce that every other page carries the banner until T50 removes the test together with the banners.

#### Scenario: page without the banner

- **WHEN** a page under `docs/guide/` other than the changelog and contributing snippets lacks the banner
- **THEN** `pnpm test:contract` fails and names the page

### Requirement: Deploy only from main

The docs workflow SHALL deploy the site to GitHub Pages only on a push to `main`. On a pull request and on a push to any other branch it SHALL only build. `main` SHALL NOT carry `mkdocs.yml` before the 3.0 release, so the first deploy is the 3.0 release.

#### Scenario: pull request into staging/v3

- **WHEN** a pull request into `staging/v3` changes a page
- **THEN** the docs workflow runs the strict build and does not deploy

#### Scenario: push to main

- **WHEN** a commit that carries `mkdocs.yml` lands on `main`
- **THEN** the docs workflow builds the site strictly and publishes it to the `gh-pages` branch

### Requirement: docs-sync dev skill

The repository SHALL carry the dev-time skill `.claude/skills/docs-sync/`. It audits the site against the code, and its docs map indexes only files that exist on `staging/v3`. Its first step SHALL run the drift guards through `pnpm test:contract`, not through pytest. The skill SHALL NOT ship with the plugin.

#### Scenario: docs map names a removed file

- **WHEN** the docs map of `docs-sync` is checked against the repository tree
- **THEN** every repository path it names exists

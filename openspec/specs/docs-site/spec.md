# docs-site Specification

## Purpose

Defines the BDK user documentation site: its location under `docs/`, its strict build, the guards that keep it indexed and true to the code, how pages that describe v2 are marked, and when it deploys.

## Requirements

### Requirement: Site location

The site SHALL be a VitePress site whose source directory is `docs/guide/`, configured by `docs/guide/.vitepress/config.ts`. Everything else under `docs/` (temporary material, task artifacts, ADRs, the `docs/v3/` archive, `HOST-FACTS.md`) SHALL stay outside the site and SHALL NOT need a sidebar entry. The site toolchain SHALL be devDependencies of the root `package.json`, pinned to exact versions and locked in `pnpm-lock.yaml`; the site SHALL need no Python.

#### Scenario: a temporary document is added

- **WHEN** a contributor adds a Markdown file under `docs/` outside `docs/guide/`
- **THEN** the strict build and the drift guards pass without a change to the site config

#### Scenario: build without Python

- **WHEN** `pnpm install` and `pnpm docs:build` run on a machine without Python or uv
- **THEN** the build succeeds and writes the site

### Requirement: Strict build

`pnpm docs:build` SHALL build the site and fail on a dead link, so a page that links to a page that does not exist fails the build. The build SHALL run in the docs workflow on every pull request and every push to `main` or `staging/v3`. A link to an anchor that the target page does not have SHALL fail the drift guards, since the dead link check covers pages only.

#### Scenario: broken link

- **WHEN** a page links to a page that does not exist
- **THEN** `pnpm docs:build` exits non-zero, and the docs workflow fails the pull request

#### Scenario: broken anchor

- **WHEN** a page links to `#<slug>` of an existing page that has no heading with that slug
- **THEN** `pnpm test:contract` fails and names the page, the link and the missing anchor

### Requirement: Deploy only from main

The docs workflow SHALL deploy the site to GitHub Pages only on a push to `main`. On a pull request and on a push to any other branch it SHALL only build. `main` SHALL NOT carry the site config before the 3.0 release, so the first deploy is the 3.0 release.

#### Scenario: pull request into staging/v3

- **WHEN** a pull request into `staging/v3` changes a page
- **THEN** the docs workflow runs the strict build and does not deploy

#### Scenario: push to main

- **WHEN** a commit that carries `docs/guide/.vitepress/config.ts` lands on `main`
- **THEN** the docs workflow builds the site strictly and publishes it to GitHub Pages

### Requirement: docs-sync dev skill

The repository SHALL carry the dev-time skill `.claude/skills/docs-sync/`. It audits the site against the code, and its docs map indexes only files that exist on `staging/v3`. Its first step SHALL run the drift guards through `pnpm test:contract`. A test in the same suite SHALL check that every repository path the skill and its docs map name exists; a path with a placeholder (`<name>`, `*`) is not checked. The skill SHALL NOT ship with the plugin.

#### Scenario: docs map names a removed file

- **WHEN** the docs map of `docs-sync` names `skills/setup/SKILL.md` after the skill moved to `skills/stages/setup/`
- **THEN** `pnpm test:contract` fails and names the missing path

### Requirement: Site drift guards

Vitest tests in the `contract` project SHALL enforce seven invariants:

1. Every user-invocable skill (`skills/*/SKILL.md` without `user-invocable: false`) is listed in `README.md` and has a `## /bdk:<name>` section in the skills reference page.
2. Every `agents/*.md` is named in the agents reference page.
3. Every page under `docs/guide/` is in the sidebar of the site config, and every sidebar entry names an existing page.
4. Every repository-root `hooks/<dir>` or `hooks/<dir>/<file>` path named in the site pages, skills, rules, agents, `.claude/rules/`, `STARTUP_INSTRUCTIONS.md`, `README.md`, `CONTRIBUTING.md`, `CLAUDE.md` and `hooks/hooks.json` exists.
5. Every in-site link with an anchor names a heading slug of its target page, computed the way the site computes it.
6. Every `bdk <command>` named in `README.md` and in the site pages resolves to a command of the registry, except on the migration page.
7. Every suite directory under `evals/suites/` is named on the eval page.

The guards SHALL run in `pnpm test:contract`.

#### Scenario: skill without a reference section

- **WHEN** a user-invocable skill is added without a section in the skills reference page
- **THEN** `pnpm test:contract` fails and names the skill

#### Scenario: page outside the sidebar

- **WHEN** a page is added under `docs/guide/` without a sidebar entry
- **THEN** `pnpm test:contract` fails and names the page

#### Scenario: prose names a missing hook

- **WHEN** a skill names `hooks/<dir>/<file>` and that file does not exist
- **THEN** `pnpm test:contract` fails and names the file, the line and the path

#### Scenario: README names a command the kernel does not have

- **WHEN** `README.md` names `bdk import`
- **THEN** `pnpm test:contract` fails and names the file, the line and the command

### Requirement: Site describes only shipped mechanisms

The site and `README.md` SHALL NOT describe a mechanism BDK does not ship: tool tiers, a tier choice page, a BDK-bundled MCP server, code-review-graph hooks (ADR-0001), the v2 settings file `.bdk/settings.json` with its `check-bdk-config` hook and `render_startup.py`, a Python script or hook of BDK, or a v2 workflow (the skills `create-plan`, `subagent-execute-plan`, `add-rule` and `refine-rules`, and the paths `.bdk/plans/`, `.bdk/design/`, `.bdk/runs/` and `.bdk/verify-plan/`). The migration page is the one exception: it names the v2 skills and paths to map them to v3. The settings keys are documented on `reference/configuration.md`. A page MAY name an MCP server only as a tool that the user installs themselves.

#### Scenario: removed tool layer and settings

- **WHEN** the pages under `docs/guide/` and the site config are searched for `tool-tiers`, `tool tier`, `choosing-a-tier`, `register-graph-repo`, `.mcp.json`, `check-bdk-config`, `render_startup`, `reference/settings.md`, and for Serena or code-review-graph named as bundled with BDK
- **THEN** there is no match

#### Scenario: removed Python scripts

- **WHEN** the pages under `docs/guide/` are searched for `bdk_run_state`, `is-command-exists`, `sentinel-echo` and the pattern `(scripts|hooks)/\S*\.py`
- **THEN** there is no match

#### Scenario: v2 workflow outside the migration page

- **WHEN** `README.md` and the pages under `docs/guide/` other than `getting-started/migration-from-v2.md` are searched for `create-plan`, `subagent-execute-plan`, `refine-rules`, `add-rule`, `.bdk/plans/`, `.bdk/design/`, `.bdk/runs/` and `.bdk/verify-plan/`
- **THEN** there is no match

#### Scenario: settings page

- **WHEN** a page needs the settings keys
- **THEN** it links to `reference/configuration.md`, which lists every key of the configuration registry

### Requirement: README v3

`README.md` SHALL describe BDK v3 in this order: what BDK is; installation (Claude Code, Node >= 22.13, the marketplace, the `bdk` and `bdk-craft` plugins); a quick start that runs `/bdk:setup`, opens a Change and drives it with `/bdk:run`; the Change pipeline with its gates and `run`; profiles; layered configuration; rules and the learning funnel; the skills table; and a link to the migration page of the site. It SHALL state the requirements once. Reference detail (every settings key, every command, the removed skills) SHALL live in the site, and the README SHALL link to it instead of repeating it.

#### Scenario: requirements stated once

- **WHEN** `README.md` is read
- **THEN** it has one requirements statement, a quick start and a link to `getting-started/migration-from-v2`

#### Scenario: no v2 framing

- **WHEN** `README.md` is searched for `STARTUP_INSTRUCTIONS.md` as the source of environment discovery, `/bdk:create-plan` or `/bdk:subagent-execute-plan`
- **THEN** none appears outside the link to the migration page

### Requirement: Migration from v2 page

The site SHALL hold `getting-started/migration-from-v2.md`, the one page that tells a v2 user how to move to v3. It SHALL state that v2 gets no support after 3.0 (hard cut); list the steps (install Node, update the plugin, run `/bdk:setup`, which detects the v2 layout, migrates the settings, imports hand-written rules and deletes the v2 paths); map each removed v2 skill and artifact to its v3 replacement; and name what is not migrated. Other pages SHALL link to it instead of carrying their own migration notes.

#### Scenario: migration content in one place

- **WHEN** the site is searched for the table of removed skills and the table of v2 artifacts
- **THEN** both are on the migration page only, and `getting-started/setup.md` links to it

### Requirement: Eval page for contributors

The site SHALL hold `contributing/evals.md`, the contributor guide to the evals. It SHALL explain why the evals exist (the A/A noise floor and the difference rule, the execute A/B, the rules no-op measurement, the review models measurement, the regression eval, the with / without admission of craft skills, the stage skill cases); what each suite measures and which decision it fed; how to run a suite and read its report; the run cap and the probe-first workflow; where results and reports live; how to add a with / without task file and a stage case; and why CI runs only the model-free check. `evals/README.md` SHALL hold only a pointer to the page and the command synopsis.

#### Scenario: a contributor looks for the evals

- **WHEN** a contributor opens the Contributing section of the site
- **THEN** the sidebar lists the eval page, and the page names every suite under `evals/suites/` with what it measures

#### Scenario: a new suite without documentation

- **WHEN** a directory is added under `evals/suites/` and the eval page does not name it
- **THEN** `pnpm test:contract` fails and names the suite

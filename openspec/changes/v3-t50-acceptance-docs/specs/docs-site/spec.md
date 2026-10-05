# Spec Delta

## ADDED Requirements

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

## MODIFIED Requirements

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

## REMOVED Requirements

### Requirement: v2 banner

**Reason**: T50 rewrites or deletes every page that described v2, so no page carries the banner and the test that enforced it has nothing to check. The spec named T50 as the task that removes the test together with the banners.
**Migration**: The guard against v2 content moves to "Site describes only shipped mechanisms" (scenario "v2 workflow outside the migration page"); `kernel/tests/docs/banner.test.ts` is deleted.

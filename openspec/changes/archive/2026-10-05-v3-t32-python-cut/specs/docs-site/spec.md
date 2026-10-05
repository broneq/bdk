## ADDED Requirements

### Requirement: Site drift guards

Vitest tests in the `contract` project SHALL enforce five invariants:

1. Every user-invocable skill (`skills/*/SKILL.md` without `user-invocable: false`) is listed in `README.md` and has a `## /bdk:<name>` section in the skills reference page.
2. Every `agents/*.md` is named in the agents reference page.
3. Every page under `docs/guide/` is in the sidebar of the site config, and every sidebar entry names an existing page.
4. Every repository-root `hooks/<dir>` or `hooks/<dir>/<file>` path named in the site pages, skills, rules, agents, `.claude/rules/`, `STARTUP_INSTRUCTIONS.md`, `README.md`, `CONTRIBUTING.md`, `CLAUDE.md` and `hooks/hooks.json` exists.
5. Every in-site link with an anchor names a heading slug of its target page, computed the way the site computes it.

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

### Requirement: Site describes only shipped mechanisms

The site SHALL NOT describe a mechanism BDK does not ship: tool tiers, a tier choice page, a BDK-bundled MCP server, code-review-graph hooks (ADR-0001), the v2 settings file `.bdk/settings.json` with its `check-bdk-config` hook and `render_startup.py`, or a Python script or hook of BDK. A page that needs the settings links to the settings section of `README.md` until T50 writes the v3 page. A page MAY name an MCP server only as a tool that the user installs themselves.

#### Scenario: removed tool layer and settings

- **WHEN** the pages under `docs/guide/` and the site config are searched for `tool-tiers`, `tool tier`, `choosing-a-tier`, `register-graph-repo`, `.mcp.json`, `check-bdk-config`, `render_startup`, `reference/settings.md`, and for Serena or code-review-graph named as bundled with BDK
- **THEN** there is no match

#### Scenario: removed Python scripts

- **WHEN** the pages under `docs/guide/` are searched for `bdk_run_state`, `is-command-exists`, `sentinel-echo` and the pattern `(scripts|hooks)/\S*\.py`
- **THEN** there is no match

## MODIFIED Requirements

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

### Requirement: v2 banner

Every page that describes v2 behaviour SHALL open, directly under its title, with the same warning container. The container SHALL say that the page describes BDK v2 and that the v3 documentation (T50) replaces it. The pages that only include `CHANGELOG.md` and `CONTRIBUTING.md` SHALL carry no banner. A page a task has already rewritten for v3 (T31: `concepts/quality-and-language-rules.md` and `workflows/rules-hygiene.md`; T41: `getting-started/setup.md`; T45: `concepts/worktree-parts.md`) SHALL carry no banner either, and the test SHALL list it by name, so a page leaves the banner only by a task's decision. A test SHALL enforce that every other page carries the banner until T50 removes the test together with the banners.

#### Scenario: page without the banner

- **WHEN** a page under `docs/guide/` other than the changelog and contributing include pages and the pages rewritten for v3 lacks the banner
- **THEN** `pnpm test:contract` fails and names the page

#### Scenario: page rewritten for v3

- **WHEN** the banner test reads `docs/guide/concepts/quality-and-language-rules.md`
- **THEN** it skips the page, which describes the v3 rules and carries no banner

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

## REMOVED Requirements

### Requirement: Drift guards

**Reason**: Restated as "Site drift guards" for the VitePress sidebar and the anchor guard.

**Migration**: Read "Site drift guards".

### Requirement: No pages about removed mechanisms

**Reason**: Restated as "Site describes only shipped mechanisms", without task history in its scenarios.

**Migration**: Read "Site describes only shipped mechanisms".

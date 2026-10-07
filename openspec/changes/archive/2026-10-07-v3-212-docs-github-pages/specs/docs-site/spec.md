# Spec Delta

## Purpose

Defines the published BDK documentation site: what it holds, how it renders the design documents, and how it reaches GitHub Pages from `main`.

## ADDED Requirements

### Requirement: The site deploys to GitHub Pages from main
A push to `main` that changes a file under `docs/`, `pnpm-lock.yaml` or `.github/workflows/docs.yml` SHALL build the VitePress site in `docs/` and deploy it to GitHub Pages at `https://broneq.github.io/bdk/`. A manual run of the docs workflow on `main` SHALL deploy the same way. A push to any other branch, `staging/v3` included, SHALL NOT deploy the site. Two deployments SHALL NOT run at the same time.

#### Scenario: Merge to main that changes docs
- **WHEN** a pull request that changes a page under `docs/` merges into `main`
- **THEN** the docs workflow builds the site and deploys it, and `https://broneq.github.io/bdk/` serves the changed page

#### Scenario: Merge to main without docs changes
- **WHEN** a pull request that changes no file under `docs/`, `pnpm-lock.yaml` or `.github/workflows/docs.yml` merges into `main`
- **THEN** no docs workflow run starts

#### Scenario: Merge to staging/v3
- **WHEN** a pull request that changes a page under `docs/` merges into `staging/v3`
- **THEN** no docs workflow run starts and the published site is unchanged

#### Scenario: Failed build
- **WHEN** the site build fails in a docs workflow run
- **THEN** the run fails and the published site stays as it was

### Requirement: The site works under the /bdk/ path
Every page, asset and internal link of the built site SHALL resolve under the path `/bdk/`.

#### Scenario: Internal link
- **WHEN** a reader opens `https://broneq.github.io/bdk/` and follows a link in the sidebar
- **THEN** the linked page loads with its styles, under `/bdk/`

### Requirement: The sidebar lists every ADR and design
The site SHALL have a home page and a navigation bar, and its sidebar SHALL list every Markdown file in `docs/adr/` and `docs/design/`, in file-name order, titled by the plain text of the file's first level-one heading up to its first " - ". A new file in either directory SHALL appear in the sidebar without a change to the site configuration.

#### Scenario: New ADR
- **WHEN** a contributor adds `docs/adr/0004-<slug>.md` whose first line is `# ADR-0004: <title> - <summary>`
- **THEN** the built site's sidebar lists `ADR-0004: <title>` under the ADRs, after ADR-0003, linking to that page

### Requirement: Mermaid diagrams render as diagrams
A fenced code block with the language `mermaid` in a site page SHALL render as a diagram, in both the light and the dark theme, and SHALL re-render when the reader switches the theme.

#### Scenario: Diagram in a design document
- **WHEN** a reader opens the v3 architecture design page on the site
- **THEN** each of its `mermaid` blocks shows as an SVG diagram, not as code

#### Scenario: Theme switch
- **WHEN** a reader switches the site from the light to the dark theme on a page with a diagram
- **THEN** the diagram is drawn again with the dark theme

### Requirement: Links into the archive point to GitHub
The `docs/v3-draft1/` archive SHALL stay out of the site. A relative link from a site page to a file in the archive SHALL point to that file on GitHub, `https://github.com/broneq/bdk/blob/main/docs/v3-draft1/<path>`, keeping any `#anchor`. A relative link to an archive file that does not exist SHALL fail the site build and name the page and the link.

#### Scenario: Link to an archive file
- **WHEN** a design document links to `../v3-draft1/run-b1/2026-10-07-bdk-v3-findings.md`
- **THEN** the built page links to `https://github.com/broneq/bdk/blob/main/docs/v3-draft1/run-b1/2026-10-07-bdk-v3-findings.md`

#### Scenario: Link to a missing archive file
- **WHEN** a pull request adds a link from a site page to `../v3-draft1/missing.md`
- **THEN** the site build fails, the `docs` PR job fails, and the error names the page and `../v3-draft1/missing.md`

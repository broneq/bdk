# docs-site Specification

## Purpose
Defines the published BDK documentation site: the user documentation it holds (Guide, Concepts, a Reference generated from the plugin sources) next to the decisions and designs, the checks that keep it true to the code, how it renders, and how it reaches GitHub Pages from `main`.

## Requirements

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
The site SHALL have a home page and a navigation bar. Its sidebar SHALL hold, in this order, the sections Guide, Concepts, Reference, Architecture decisions and Designs. The Guide, Concepts and Reference sections SHALL list their pages in a declared reading order. The Architecture decisions and Designs sections SHALL list every Markdown file in `docs/adr/` and `docs/design/`, in file-name order, titled by the plain text of the file's first level-one heading up to its first " - ", and a new file in either directory SHALL appear in the sidebar without a change to the site configuration. A Markdown page under `docs/guide/`, `docs/concepts/` or `docs/reference/` that the sidebar does not list, or a sidebar link to a page that does not exist, SHALL fail `pnpm check` and name the page or the link.

#### Scenario: New ADR
- **WHEN** a contributor adds `docs/adr/0004-<slug>.md` whose first line is `# ADR-0004: <title> - <summary>`
- **THEN** the built site's sidebar lists `ADR-0004: <title>` under the ADRs, after ADR-0003, linking to that page

#### Scenario: Section order
- **WHEN** a reader opens any page of the site
- **THEN** the sidebar shows Guide, Concepts, Reference, Architecture decisions and Designs, in that order

#### Scenario: Concepts page missing from the sidebar
- **WHEN** a contributor adds `docs/concepts/<slug>.md` without adding it to the sidebar
- **THEN** `pnpm check` fails and names `docs/concepts/<slug>.md`

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

### Requirement: The Guide takes a new user from install to a pull request
The home page SHALL lead to the Guide first: its primary action and the first navigation item SHALL open the Guide. The Guide SHALL tell a reader who has never seen the BDK sources what BDK is, how to add the marketplace and install each plugin, how to configure a project with `/bdk:setup`, how to run the idea-to-PR workflow (`/bdk:propose`, `/bdk:design`, `/bdk:plan`, `/bdk:execute`, `/bdk:auto-review`, `/bdk:close`, and `/bdk:run` as the autopilot over them), how to change the configuration, with whole settings files for typical projects, and what a run costs, may do without asking and leaves in the repository. The Concepts section SHALL explain OpenSpec Changes, blocks and orchestrators, what each stage checks and what it leaves alone, agents and models, run state under `.bdk/runs/` (why each file exists, who reads it later, and what deleting it does), findings, gates and budgets, E2E checks as a user, and rules (how a project adds its own and switches one off), with a glossary, and SHALL show the flows as Mermaid diagrams.

#### Scenario: First run from the site alone
- **WHEN** a user who has not read the BDK sources follows the Guide in a new test project
- **THEN** they install BDK from the marketplace, configure the project with `/bdk:setup` and take one intent through the workflow to an open pull request, without opening a file of the BDK repository

#### Scenario: Home page
- **WHEN** a reader opens `https://broneq.github.io/bdk/`
- **THEN** the primary action of the home page opens the first Guide page

### Requirement: The Reference is generated from the plugin sources
The Reference section SHALL hold one section per plugin under `plugins/` (`bdk`, `bdk-craft`, `bdk-skill-kit`, `git-identity`). Its pages SHALL be generated from the plugin sources by one repository command and committed: each skill from its `SKILL.md` frontmatter (name, how it is invoked, arguments, description, and whether a user can invoke it), each agent from its frontmatter (name, description, model, tools), each hook from the plugin's `hooks.json` (event, matcher, what it runs), each `bdk` command from its declaration (the same usage, arguments, flags and exit codes `bdk <group> <verb> --help` prints), each settings key from the settings schema (key, type, default, description, and the examples the schema gives), with each top-level section of the settings page shown whole in one YAML block (the schema's example laid over every key's default, a comment per key, and the default of a key the example changes), and each rule of the BDK rule pack from its rule file (id, title, kind, stages, file globs, language pack, text). A Reference page SHALL NOT be edited by hand; it SHALL say so in a comment at its top. The generator SHALL fail and name the item when a source item lacks the field its entry needs.

#### Scenario: Skill entry
- **WHEN** a reader opens the Reference section of the `bdk` plugin
- **THEN** it holds an entry for `/bdk:plan` with its argument hint and the description from `plugins/bdk/skills/plan/SKILL.md`

#### Scenario: Internal skill
- **WHEN** a skill's frontmatter sets `user-invocable: false`
- **THEN** its Reference entry marks it as started by other skills, not by the user

#### Scenario: Rule catalogue
- **WHEN** a reader opens the rules page of the `bdk` Reference
- **THEN** it lists every rule of `plugins/bdk/rules/` with the id `rules.disabled` takes, its title, stages and file globs

#### Scenario: Settings key without a description
- **WHEN** a contributor adds a key to the settings schema without a description and runs the generator
- **THEN** the generator fails and names the key

### Requirement: Reference drift fails pnpm check
`pnpm check` SHALL fail when the committed Reference pages differ from what the generator produces from the current sources: a skill, agent, hook, `bdk` command or settings key without its entry, an entry for one that no longer exists, or an entry whose facts changed. The failure SHALL name each page that differs and the command that regenerates it.

#### Scenario: Skill removed
- **WHEN** a pull request deletes `plugins/bdk/skills/<name>/` and leaves the Reference as it was
- **THEN** `pnpm check` fails, naming the `bdk` skills Reference page and the regenerate command

#### Scenario: Settings key added
- **WHEN** a pull request adds a key to the settings schema and leaves the Reference as it was
- **THEN** `pnpm check` fails, naming the `bdk` settings Reference page

#### Scenario: CLI command renamed
- **WHEN** a pull request renames a `bdk` command and leaves the Reference as it was
- **THEN** `pnpm check` fails, naming the `bdk` CLI Reference page

#### Scenario: Reference regenerated
- **WHEN** a contributor runs the regenerate command after any of these source changes and commits the result
- **THEN** `pnpm check` passes the drift check

### Requirement: Hand-written pages name only what exists
`pnpm check` SHALL fail when a page under `docs/guide/` or `docs/concepts/`, in its prose or in a Mermaid block, names a skill as `/<plugin>:<name>`, a `bdk` command as `bdk <group> <verb>`, a settings key by its full dotted path, a rule of the pack by its id (`BDK-CQ-1`), or an agent by a link to its Reference entry, that does not exist in the plugin sources. The failure SHALL name the page, the line and the name.

#### Scenario: Renamed skill in a diagram
- **WHEN** a pull request renames the skill `review-round` and a Mermaid block in `docs/concepts/orchestrators.md` still names `/bdk:review-round`
- **THEN** `pnpm check` fails and names `docs/concepts/orchestrators.md`, the line and `/bdk:review-round`

#### Scenario: Removed settings key in the Guide
- **WHEN** a pull request removes `policy.budgets.verifier` and a Guide page still names it
- **THEN** `pnpm check` fails and names that page and `policy.budgets.verifier`

### Requirement: Mermaid blocks parse
`pnpm check` SHALL fail when a `mermaid` block in a site page does not parse as a Mermaid diagram, and SHALL name the page and the block's line.

#### Scenario: Syntax error in a diagram
- **WHEN** a pull request adds a `mermaid` block with a syntax error to a Concepts page
- **THEN** `pnpm check` fails and names the page and the block's line

### Requirement: The site follows the Broniszewski design system
The site SHALL take its colors, type, spacing, radii and component styles from the Broniszewski design system (https://github.com/broneq/design-system), from an unchanged copy of its tokens in the repository that names the design system commit it came from, in the light and the dark theme. It SHALL self-host its fonts and SHALL NOT load fonts, styles or scripts from another host. The dark theme the site applies SHALL equal the design system's dark theme, and `pnpm check` SHALL fail when they differ. A page's first heading "<title> - <summary>" SHALL show as the title ending with the brand's blue period, followed by the summary as the page's lead, and the browser tab SHALL show the title.

#### Scenario: Dark theme drift
- **WHEN** an update of the copied tokens changes a value of the design system's dark theme and the site's dark theme is left as it was
- **THEN** `pnpm check` fails and names the variable

#### Scenario: Fonts from the site
- **WHEN** a reader opens any page of the site
- **THEN** every font, style and script the page loads comes from the site's own host

#### Scenario: Page header
- **WHEN** a reader opens `docs/guide/install.md` on the site, whose first heading reads "Install - add the BDK marketplace and the plugins you want"
- **THEN** the page shows "Install" ending with the blue period, the summary below it as the lead, and the browser tab reads "Install | BDK"

### Requirement: One site for the current release
The site SHALL document one version of BDK: the version on `main`, which is the released one. It SHALL NOT keep pages per version. The Guide SHALL link to the `v2.7.0` README for users of BDK v2.

#### Scenario: Released change
- **WHEN** a release of the `bdk` plugin merges into `main` with its regenerated Reference
- **THEN** the published site documents that release, and no page of an older v3 release remains on it

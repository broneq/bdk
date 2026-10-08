# Proposal

## Why

Tracks #268.

BDK v3 has no user documentation: the VitePress site in `docs/` holds only ADRs and designs, so a new user cannot install BDK and run the idea-to-PR workflow without reading the plugin sources. Writing the pages once is not enough either. Skills, agents, `bdk` commands and settings keys still change (#267, #245, #252, #256), and documentation that nobody is forced to update goes stale - the "living documentation" problem that v3 sets out to solve (CLAUDE.md, "Goal of this line", problem 3). The repository must make it impossible to merge a change to BDK with stale docs.

## What Changes

- **Site structure.** The site gets four sections in reading order: Guide (what BDK is, install from the marketplace, first run with `/bdk:setup`, the idea-to-PR workflow, configuration), Concepts (OpenSpec Changes, blocks and orchestrators, agents and models, run state under `.bdk/runs/`, findings, gates and budgets, E2E as a user), Reference (one section per plugin: `bdk`, `bdk-craft`, `bdk-skill-kit`, `git-identity`) and the existing Decisions and Designs. The home page and the navigation lead a new user to the Guide first.
- **Flow diagrams folded into Concepts.** The Mermaid flow diagrams drawn on `docs/bdk-flow-diagrams` land as five Concepts pages (`workflow`, `orchestrators`, `agents`, `run-state`, `cli-config-hooks`) under `docs/concepts/`, not as a separate page. They are copied into this branch when the `flow` session reports them ready; this Change does not redraw them.
- **Generated Reference.** The Reference pages are generated from the sources by a script (`pnpm docs:reference`) and committed: skill and agent frontmatter, `hooks.json`, the `bdk` CLI command declarations (the same text as `--help`) and the settings schema in `plugins/bdk/src/config/domain/settings.ts`. Every settings key gets a description in the schema itself, so the schema is the one source of the settings reference.
- **Drift check in `pnpm check`.** A test regenerates the Reference and fails when the committed pages differ, in both directions (a source item without an entry, an entry for an item that is gone). A second test scans the hand-written pages (Guide, Concepts, prose and Mermaid blocks) and fails when they name a skill, agent, `bdk` command or settings key that no longer exists. A third test checks that every page under `guide/`, `concepts/` and `reference/` is in the sidebar and every sidebar link has a page. A fourth test parses every Mermaid block, so a broken diagram fails CI instead of showing an error in the browser.
- **Rules for the hand-written pages.** The SDLC in `CLAUDE.md` and the `tasks` rules of `openspec/config.yaml` require a docs task in every Change that changes user-visible behaviour, checked as an unchecked task by `/opsx:verify` and named in the archive guidance.
- **CI signal.** A new PR job, `docs-impact` (its own workflow, so editing the PR body re-runs only it), fails a pull request that changes user-visible sources (`plugins/*/skills`, `plugins/*/agents`, `plugins/*/hooks`, `plugins/*/src`, `openspec/specs`) without changing hand-written pages under `docs/`, unless the PR body carries a `Docs-impact: none - <reason>` line. A pull request template puts that line in front of the reviewer.
- **The Broniszewski design system.** The site takes its colors, type, spacing and component styles from https://github.com/broneq/design-system: an unchanged copy of its tokens, mapped onto the VitePress default theme in the light and the dark theme, self-hosted fonts, page headers with the brand's blue period, and a home page built from its components. Asked for by the maintainer during the review of this Change.
- **One site, the current release.** The site documents the released version only; there are no per-version docs.

## Capabilities

### New Capabilities

None. The user documentation is a promise of the existing `docs-site` capability, and the docs rules are part of `repo-sdlc`.

### Modified Capabilities

- `docs-site`: the site follows the Broniszewski design system; the sidebar requirement grows from "every ADR and design" to the Guide, Concepts, Reference, Decisions and Designs sections with the home page leading to the Guide; new requirements for the generated Reference and its drift check, the name check over hand-written pages, the Mermaid parse check, and one site for the current release.
- `repo-sdlc`: new requirements for the docs task in every behaviour-changing Change and for the `docs-impact` job; the required-checks requirement lists `docs-impact`.
- `bdk-cli/config`: every settings key carries a description in the settings schema, the source of the settings reference.

## Impact

- `docs/`: new `guide/`, `concepts/`, `reference/` pages; `docs/.vitepress/config.ts` and a new explicit sidebar for the user sections; `docs/index.md`; the theme in `docs/.vitepress/theme/` (design system tokens, `brand.css`, layout, home page, Mermaid colors), favicons in `docs/public/`, and new docs dependencies (`@fontsource-variable/*`, `happy-dom`, `vue-tsc`).
- `scripts/docs-reference.ts` (generator) with its tests; root `package.json` script `docs:reference`; new tests under `docs/.vitepress/` and `scripts/`.
- `plugins/bdk/src/config/domain/settings.ts` (descriptions on every key) and `describe.ts` beside it (the key list the settings Reference prints). The generator reads the `bdk` command declarations through `src/slices.ts` and each slice's group factory, with no change to the CLI.
- `.github/workflows/docs-impact.yml` (job `docs-impact`), `.github/pull_request_template.md`; `docs-impact` becomes a required status check on `main` and `staging/v3` (a repository setting the maintainer applies).
- `CLAUDE.md` (SDLC), `openspec/config.yaml` (`tasks` rules, `apply` and `archive` guidance).
- Input carried over: `openspec/specs/docs-site/spec.md` and the archived Change `2026-10-07-v3-212-docs-github-pages` (D1 deploy from `main` only, D2 Mermaid component, D3 sidebar generated from the files), ADR-0002 (`docs/` holds the VitePress site), ADR-0003 and `docs/design/2026-10-07-v3-architecture.md` for the concepts, written against `plugins/*/` and `openspec/specs/` as built.
- Out of scope: `README.md`, which #170 rewrites to link to the site for user docs and reference, `CONTRIBUTING.md` (#171), the design-vs-code discrepancies found while drawing the diagrams (the `flow` session hands them to the user as separate issues), and reference pages for CLIs other than `bdk` (the `skill-check` CLI of `bdk-skill-kit` is documented through its skill).

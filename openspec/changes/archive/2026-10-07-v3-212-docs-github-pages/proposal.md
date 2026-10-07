# Proposal

## Why

Tracks #212.

ADR-0002 and its design section "Docs and evals" put the docs site on GitHub Pages, deployed from `main` by `docs.yml`. Today the VitePress site from #172 is only built on pull requests: nobody can read BDK's documentation without cloning the repository, the Mermaid diagrams of the design documents show as code, and links into the `docs/v3-draft1/` archive lead nowhere on the site.

## What Changes

- `.github/workflows/docs.yml`: on a push to `main` that changes `docs/**`, `pnpm-lock.yaml` or the workflow itself, and on `workflow_dispatch`, build the site with `pnpm --filter @bdk/docs docs:build`, upload it with `actions/upload-pages-artifact` and deploy it with `actions/deploy-pages` (`pages: write`, `id-token: write`, `concurrency: pages`).
- Repository setting: Pages source "GitHub Actions".
- VitePress `base: "/bdk/"`, so the site works at `https://broneq.github.io/bdk/`.
- Site structure: a VitePress home page, top navigation, and a sidebar for ADRs and designs generated from the files in `docs/adr/` and `docs/design/`, so a new document appears without editing the config.
- Mermaid code blocks render as diagrams, in the light and the dark theme.
- Links from site pages into `docs/v3-draft1/` (excluded from the site, it does not compile) point to the file on GitHub. A link to an archive file that does not exist fails the build, so the dead-link guarantee of the `docs` PR job covers archive links too.

### Resolved from "To resolve in the spec"

- **Deploy from `main` only, or also from `staging/v3`:** `main` only, as the design section "Docs and evals" says and as releases do (spec `plugin-release`, "Releases run only from main"). The site shows released documentation; the first deployment happens when `staging/v3` merges into `main`. See design.md D1.
- **Mermaid integration:** a small custom component, not `vitepress-plugin-mermaid`. See design.md D2.

### Out of scope

- Content of the ADRs, designs and README: unchanged, except that no document needs editing for the archive links to work.
- Release flow verification on `main`: #213. The first real deployment of the site is checked in the same post-merge run (see design.md, Migration Plan).

## Capabilities

### New Capabilities

- `docs-site`: what the published documentation site holds and how it is published - deployment from `main` to GitHub Pages, generated navigation, Mermaid rendering and links into the archive.

### Modified Capabilities

None. The `docs` PR job (spec `repo-sdlc`, "The docs site builds when its inputs change") keeps its behaviour, including failing on a dead link.

## Impact

- New: `.github/workflows/docs.yml`, `docs/.vitepress/theme/` (theme entry, Mermaid component, styles), helper modules with their tests and a `tsconfig.json` under `docs/.vitepress/`.
- Changed: `docs/.vitepress/config.ts`, `docs/index.md`, `docs/package.json` (dev dependencies `mermaid` and `typescript`, a `typecheck` script), `pnpm-lock.yaml`, `tsconfig.json`, `vitest.config.ts`.
- GitHub settings: Pages enabled on `broneq/bdk` with source "GitHub Actions"; the `github-pages` environment deploys from `main` only.

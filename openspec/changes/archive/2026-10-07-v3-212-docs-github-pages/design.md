# Design

## Context

The VitePress site from #172 (`docs/`, package `@bdk/docs`, VitePress 1.6.4) builds on pull requests in the `docs` job of `pr.yml` and fails on a dead link. Its config lists the ADRs and designs by hand, excludes `docs/v3-draft1/**` (raw HTML-like text in `HOST-FACTS.md` breaks the Vue compiler) and silences dead-link checks for links into it. The two design documents hold 17 `mermaid` blocks, which VitePress shows as code. Pages is not enabled on `broneq/bdk` (`GET /repos/broneq/bdk/pages` returns 404); the repository is public. Root `tsc`, eslint (`strictTypeChecked`) and prettier already cover `docs/.vitepress/**/*.ts`; Markdown is not formatted by prettier. The root `tsconfig.json` has no DOM library, which the theme needs.

## Goals / Non-Goals

**Goals:**
- Every piece of site logic is TypeScript that `pnpm typecheck` and eslint check, with vitest tests; no `.vue` file escapes the typecheck.
- Adding an ADR or a design document needs no config change (living documentation, CLAUDE.md goal 3).
- The dead-link guarantee of the `docs` PR job keeps holding, archive links included.

**Non-Goals:**
- Site search, a custom theme look, versioned docs.
- Rendering diagrams at build time; diagrams render in the reader's browser.
- Any change to the archive in `docs/v3-draft1/` or to the documents' text.

## Decisions

### D1. Deploy from `main` only

`docs.yml` runs on `push` to `main` (paths `docs/**`, `pnpm-lock.yaml`, `.github/workflows/docs.yml`) and on `workflow_dispatch`. The `github-pages` environment allows deployments from `main` only, so a manual run from another branch is refused by GitHub, not only by convention. The site therefore shows released documentation, the same rule as releases (spec `plugin-release`, "Releases run only from main"; design section "Docs and evals"). Until `staging/v3` merges into `main` the site does not exist; that is accepted: the v3 documents describe work in progress.

Alternative: deploy from `staging/v3` too while v3 is in progress. Lost: two branches would overwrite one site in turns, the trigger would have to be edited again at the v3 merge, and readers would see unreleased decisions as the documentation of BDK.

### D2. Mermaid through a small custom component

A markdown-it fence rule in the config turns a `mermaid` block into `<Mermaid code="..."/>` (the source URI-encoded in the attribute, so no Markdown or Vue syntax inside it is interpreted). The `Mermaid` component, registered globally by the theme, is a `defineComponent` in TypeScript with a render function: on mount it imports `mermaid` dynamically (client only, so the build never loads it and pages without diagrams never download it), calls `mermaid.initialize` with `theme: "dark"` or `"default"` from VitePress `isDark`, and `mermaid.render`s with its own element as the scratch container; a watcher on `isDark` renders again. Two details come from checking the built site in a browser: Mermaid sizes labels in a scratch element, and outside `.vp-doc` the page's `p` line height differs, which cut the last line off multi-line labels - measuring inside the component's own element fixes it. And a wide diagram shrunk to a phone's width has unreadable text, so the drawn SVG gets `min-width` of 60% of its natural width and its container scrolls sideways instead. Mermaid 12 `render` draws a syntax error as an error diagram of its own, so the component calls `mermaid.parse` first, which throws, and shows the error with the source. `mermaid` is a direct dependency of `@bdk/docs` at an exact version.

Alternatives: `vitepress-plugin-mermaid` - lost, its last release is 2.0.17 from 2024-09, it wraps the whole config (`withMermaid`) and brings its own way of loading and theming Mermaid, so a VitePress or Mermaid update can break the site with no maintainer to fix it; the custom code is about 50 lines that we test and own. Build-time rendering to SVG (`@mermaid-js/mermaid-cli`) - lost, it needs headless Chromium in CI and two SVGs per diagram for the themes. A `.vue` single-file component - lost, root `tsc` does not check `.vue` files and `vue-tsc` would be one more tool for one component.

### D3. Sidebar generated from the files

`docs/.vitepress/sidebar.ts` exports a function that, given the `docs/` directory and a subdirectory (`adr`, `design`), lists its `*.md` files in file-name order and takes each title from the first line starting with `# `; a file without one fails the config load with its path. The headings read `<title> - <summary>` (ADR-0002: "... release flow - one directory per plugin, builds on a `release` branch"), which wraps to five lines in the sidebar, so the entry shows the part before the first ` - `, without inline-code backticks; the page keeps its full heading. The config builds the two sidebar groups from it, and the top navigation links to the newest ADR and the newest design. File names are date- or number-prefixed, so file-name order is chronological.

Alternative: keep the hand-written list from #172. Lost: it goes stale silently with every new document, which is the failure mode CLAUDE.md goal 3 names. A sidebar plugin (`vitepress-sidebar`) - lost, a dependency for 20 lines of code.

### D4. Archive links rewritten to GitHub at render time, missing targets fail the build

`docs/.vitepress/archive-links.ts` is a markdown-it plugin. For each `link_open` token whose `href` is relative, it resolves the path against the page (`env.relativePath`); when the result lies under `v3-draft1/`, it checks the file exists in `docs/` and sets `href` to `https://github.com/broneq/bdk/blob/main/docs/<path>` with the original `#anchor`. A missing file throws an error naming the page and the link, which fails `vitepress build`. `ignoreDeadLinks` goes away: VitePress does not check absolute `https://` links, and every other relative link stays checked by VitePress itself. The branch in the URL is `main` because the site deploys from `main` (D1), so the archive exists there whenever the site does.

Alternatives: keep `ignoreDeadLinks` - lost, the links are dead on the site and a typo in one is never caught. Put the archive on the site - lost, it does not compile and must stay as written. Write absolute GitHub URLs into the documents - lost, relative links work in editors and in GitHub's own view, and a URL ties every document to one branch name.

### D5. `docs.yml`: build job and deploy job

The `build` job installs only `@bdk/docs` (`pnpm install --frozen-lockfile --filter @bdk/docs`, Node from `.nvmrc`), runs `pnpm --filter @bdk/docs docs:build`, and uploads `docs/.vitepress/dist` with `actions/upload-pages-artifact`. The `deploy` job needs `build`, runs in the `github-pages` environment with the page URL as its environment URL, and calls `actions/deploy-pages`. Workflow permissions are `contents: read`; only `deploy` gets `pages: write` and `id-token: write`. Workflow-level `concurrency: {group: pages, cancel-in-progress: false}`: a running deployment finishes and the newest queued run replaces any older queued one, as GitHub's Pages starter workflows do. A failed build stops before `deploy`, so the published site stays as it was.

Alternative: one job that builds and deploys. Lost: the build steps would run with `pages: write` and an OIDC token they do not need.

### D6. Pages and its environment are set through the API

`gh api -X POST repos/broneq/bdk/pages -f build_type=workflow` enables Pages with the source "GitHub Actions"; this creates the `github-pages` environment with a custom deployment branch policy that allows only `main` (checked with `gh api repos/broneq/bdk/environments/github-pages/deployment-branch-policies`), so no further setting is needed. These are one-off repository settings, done once by hand and recorded here, like the rulesets of #172; no workflow manages them.

### D7. Home page uses the VitePress home layout

`docs/index.md` gets `layout: home` with a hero (name, tagline, actions to the ADRs and the v3 architecture) and one feature card per section. Its Markdown body keeps the short status text about v3.

### D8. The site code has its own tsconfig with the DOM library

`docs/.vitepress/tsconfig.json` extends the root one and adds `dom`; the `@bdk/docs` package runs it as its `typecheck` script, which root `pnpm typecheck` already runs for every package, and the root `tsconfig.json` no longer includes `docs/.vitepress/`. eslint's project service picks the nearest tsconfig, so the files keep the strict type-checked rules. `docs/.vitepress/env.d.ts` references `vitepress/client` for CSS imports.

Alternative: add `dom` to the root config. Lost: scripts and tests run in Node, where browser globals do not exist, and the typecheck would stop catching a stray `window` in them.

## Risks / Trade-offs

- [The deployment cannot run before `staging/v3` merges into `main`] - The build is checked on every PR by the `docs` job, `docs.yml` is checked by actionlint, and the built site is checked locally under `/bdk/` with `vitepress preview`. The first real deployment is watched in the same post-merge run as the release flow (#213); #212 stays open until then with a comment saying so.
- [Mermaid is large (several MB of chunks)] - It loads only on pages with a diagram, after the page renders; text stays readable while the diagram loads.
- [A Mermaid syntax error in a document] - The component shows the error text and the diagram source instead of a blank block, so the reader still sees the content; the PR author sees it in the preview.
- [`env.relativePath` is a VitePress internal of the markdown env] - It is part of VitePress's public `MarkdownEnv` type; the archive-link test renders through VitePress's own `createMarkdownRenderer`, so a change shows up as a failing test on upgrade.

## Migration Plan

1. Merge into `staging/v3`: nothing deploys (D1); the `docs` PR job builds the new site.
2. Enable Pages (D6) before `staging/v3` merges into `main`; it is done in this Change so the setting is in place.
3. When `staging/v3` merges into `main`, `docs.yml` deploys; check `https://broneq.github.io/bdk/`, a diagram page and an archive link, then close #212.

Rollback: disable the workflow or delete Pages (`gh api -X DELETE repos/broneq/bdk/pages`); nothing else depends on the site.

# Tasks

## 1. Setup

- [x] 1.1 Add `mermaid` at an exact version to `docs/package.json`, extend `vitest.config.ts` to `docs/.vitepress/**/*.test.ts`, run `pnpm install` and verify `pnpm --filter @bdk/docs docs:build` still passes

## 2. Sidebar from files (D3)

- [x] 2.1 Write `docs/.vitepress/sidebar.test.ts` against a temporary directory: files listed in file-name order, title from the first `# ` heading, link without `.md`, a file without a heading throws with its path; verify it fails
- [x] 2.2 Implement `docs/.vitepress/sidebar.ts` and verify the test passes

## 3. Archive links (D4)

- [x] 3.1 Write `docs/.vitepress/archive-links.test.ts` rendering through VitePress `createMarkdownRenderer`: an archive link becomes the GitHub URL with its anchor, a non-archive relative link and an absolute link stay unchanged, a missing archive file throws naming the page and the link; verify it fails
- [x] 3.2 Implement `docs/.vitepress/archive-links.ts` and verify the test passes

## 4. Mermaid (D2)

- [x] 4.1 Write `docs/.vitepress/mermaid.test.ts` for the fence rule: a `mermaid` block becomes a `<Mermaid>` element whose `code` attribute decodes to the source, including `<`, `"`, `{{` and `|`; other fences render as before; verify it fails
- [x] 4.2 Implement the fence rule in `docs/.vitepress/mermaid.ts` and the `Mermaid` component and theme entry in `docs/.vitepress/theme/`, and verify the test passes

## 5. Site config and home page (D3, D4, D7)

- [x] 5.1 Wire `base: "/bdk/"`, the generated sidebar, the navigation, the archive-link plugin and the Mermaid fence into `docs/.vitepress/config.ts`, drop `ignoreDeadLinks`, and verify `docs:build` passes
- [x] 5.2 Rewrite `docs/index.md` with the home layout (hero, actions, features) and verify it builds
- [x] 5.3 Give `docs/.vitepress/` its own `tsconfig.json` with the DOM library and a `typecheck` script in `@bdk/docs` (D8), and verify `pnpm typecheck` lists the site files and passes

## 6. Deployment (D1, D5, D6)

- [x] 6.1 Write `.github/workflows/docs.yml` (build and deploy jobs, path filter, `workflow_dispatch`, permissions, `concurrency: pages`) and verify `actionlint` passes on it
- [x] 6.2 Enable Pages with source "GitHub Actions" and restrict the `github-pages` environment to `main`; verify with `gh api repos/broneq/bdk/pages` and the environment's branch policies

## 7. Acceptance and gates

- [x] 7.1 Serve the built site with `vitepress preview` under `/bdk/` and check in a browser: home page, sidebar links, styles, every diagram of both design documents as SVG in light and dark theme, theme switch re-renders, archive links point to GitHub
- [x] 7.2 Add a dead link and a missing archive link to a page, verify `docs:build` fails naming them, then remove them
- [x] 7.3 Run every check CI runs (`pnpm check`, `claude plugin validate` of the marketplace, commitlint, the docs build, `actionlint` on `.github/workflows/`), `openspec validate v3-212-docs-github-pages --strict` and `openspec validate --specs --strict`

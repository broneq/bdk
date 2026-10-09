## 1. Checks first

- [x] 1.1 Add `docs/.vitepress/diagram-fit.test.ts`: a diagram at 0.8 or more without frame overflow passes; one below 0.8 or with overflow fails naming the page, the block line, the scale and the widest width that fits; a page whose blocks did not all draw fails. Verify: the test fails before `diagram-fit.ts` exists.
- [x] 1.2 Change `docs/.vitepress/mermaid-parse.test.ts`: a block with an `init` or `initialize` directive or a `config:` frontmatter fails and names page and block line; the `wrappingWidth` case becomes one of them. Verify: the test fails on the four per-diagram init lines of `docs/concepts/`.

## 2. The fit check

- [x] 2.1 Write `docs/.vitepress/diagram-fit.ts` (serve the built site, Chromium at 1280 px, every page with a `mermaid` block) and add `playwright` 1.63.0 and the `docs:diagram-fit` script to `docs/package.json`. Verify: the tests of 1.1 pass; `pnpm --filter @bdk/docs docs:diagram-fit` after `docs:build` lists the 30 wide diagrams.
- [x] 2.2 Run it in the `docs` job of `.github/workflows/pr.yml` after the build, with Chromium installed. Verify: the job's steps read in order.

## 3. Layout and redraw

- [x] 3.1 Set the site-wide sequence layout in `docs/.vitepress/theme/mermaid-diagram.ts` (design D1) and remove the four per-diagram init lines. Verify: the tests of 1.2 pass.
- [x] 3.2 Redraw the wide diagrams of `docs/concepts/` (`workflow.md`, `run-state.md`, `agents.md`, `rules.md`, `findings.md`, `orchestrators.md`; `e2e.md` and `cli-config-hooks.md` fit with D1) by design D2, wording unchanged. Verify: `docs:diagram-fit` passes for these pages.
- [x] 3.3 Redraw the wide diagrams of `docs/design/2026-10-07-v3-architecture.md` and `docs/design/2026-10-07-v3-repo-structure-cicd.md`, content unchanged. Verify: `docs:diagram-fit` passes for these pages.

## 4. Acceptance

- [x] 4.1 Audit every page with a diagram on the rendered site in light and dark at 1280 px and 390 px: scale and overflow measured, screenshots of every changed diagram reviewed (no crossing edges, no stacked arrowheads, readable order).
- [x] 4.2 Run `pnpm docs:reference`, every check of `.github/workflows/` (`pnpm check`, the `docs` job build and `docs:diagram-fit`), `openspec validate v3-338-docs-wide-diagrams-fit --strict` and `openspec validate --specs --strict`.

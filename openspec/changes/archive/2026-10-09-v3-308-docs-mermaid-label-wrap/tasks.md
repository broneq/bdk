## 1. Checks first

- [x] 1.1 Add to `docs/.vitepress/mermaid-parse.test.ts` the failing tests: a flowchart label line over 40 characters fails and names page, block line and label line; a block setting `wrappingWidth` fails and names page and block line; every site page passes both. Verify: `pnpm vitest run docs/.vitepress/mermaid-parse.test.ts` fails on the current pages (the #307 init lines and the 13 long lines).

## 2. Site-wide wrapping off

- [x] 2.1 Set `flowchart: { wrappingWidth: 10000 }` in `mermaid.initialize` of `docs/.vitepress/theme/mermaid-diagram.ts`, with a comment saying why. Verify: `pnpm --filter @bdk/docs typecheck`.
- [x] 2.2 Remove the two `wrappingWidth` init lines of `docs/concepts/orchestrators.md` and break every flowchart label line over 40 characters in `docs/concepts/` and `docs/design/` with `<br/>` at a word boundary, wording unchanged. Verify: the tests of 1.1 pass.

## 3. Acceptance

- [x] 3.1 Audit the rendered site (dev server, every page with a flowchart) in light and dark at 1280 px and at 390 px: no label split inside a word, no page scrolls sideways as a whole, labels and boxes look right in both themes (screenshots of the changed diagrams reviewed).
- [x] 3.2 Run `pnpm docs:reference`, every check of `.github/workflows/` (`pnpm check`, the `docs` job build), `openspec validate v3-308-docs-mermaid-label-wrap --strict` and `openspec validate --specs --strict`.

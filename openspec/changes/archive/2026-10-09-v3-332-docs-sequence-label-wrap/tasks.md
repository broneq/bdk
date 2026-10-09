## 1. Checks first

- [x] 1.1 Add to `docs/.vitepress/mermaid-parse.test.ts` the failing tests: a sequence diagram with wrapping on (init line, `%%{wrap}%%`, `wrap:` prefix) fails and names page and block line; a sequence participant, message, note or block label line over 40 characters fails and names page, block line and line; every site page passes both. Verify: `pnpm vitest run docs/.vitepress/mermaid-parse.test.ts` fails on the current pages (three wrap init keys, 17 long lines).

## 2. Site-wide wrapping off

- [x] 2.1 Set `sequence: { wrap: false }` in `mermaid.initialize` of `docs/.vitepress/theme/mermaid-diagram.ts`, with the reason in the comment. Verify: `pnpm --filter @bdk/docs typecheck`.
- [x] 2.2 Remove `"wrap": true` from the three sequence init lines of `docs/concepts/orchestrators.md`, write the participant `integration<br/>reviewer`, break every sequence line over 40 characters in `docs/concepts/` and `docs/design/` with `<br/>` at a word boundary, and break more lines of the three formerly wrapped diagrams until each fits the content column at 1280 px (design D4), wording unchanged. Verify: the tests of 1.1 pass.

## 3. Acceptance

- [x] 3.1 Audit the rendered site (own dev server, every page with a sequence diagram) in light and dark at 1280 px and 390 px: no text split inside a word, no page scrolls sideways as a whole, boxes and lines look right in both themes (screenshots of the changed diagrams reviewed).
- [x] 3.2 Run `pnpm docs:reference`, every check of `.github/workflows/` (`pnpm check`, the `docs` job build), `openspec validate v3-332-docs-sequence-label-wrap --strict` and `openspec validate --specs --strict`.

## 1. Test first

- [x] 1.1 Add `docs/.vitepress/theme/label-backing.test.ts` (happy-dom, `getBBox` stubbed): every `text.messageText`, `text.loopText` and `text.sectionTitle` of a sequence SVG gets a `rect.label-backing` sized from its box widened by 4 units on each side; label and rectangle sit in one group after every line of the SVG; an ancestor `transform` carries over to the label's holder; `text.labelText`, `text.noteText` and participant texts stay where they were. Verify: `pnpm vitest run docs/.vitepress/theme/label-backing.test.ts` fails (module missing).

## 2. Backing

- [x] 2.1 Write `docs/.vitepress/theme/label-backing.ts` (`backSequenceLabels(svg)`, design D1, D2). Verify: the tests of 1.1 pass.
- [x] 2.2 Call it from `docs/.vitepress/theme/mermaid-diagram.ts` after the SVG is in the DOM, only for `aria-roledescription="sequence"` (D4); fill `.label-backing` with `var(--bg-page)` in the Diagrams section of `docs/.vitepress/theme/brand.css` (D3). Verify: `pnpm --filter @bdk/docs typecheck`.

## 3. Acceptance

- [x] 3.1 Audit the rendered site (own dev server, every page with a sequence diagram) in light and dark at 1280 px and 390 px: the pixel audit of design D5 reports no label with line pixels; screenshots of every sequence diagram reviewed (lines stop cleanly at each label, frame borders intact, no box visible against the page); a flowchart page looks as before.
- [x] 3.2 Run `pnpm docs:reference`, every check of `.github/workflows/` (`pnpm check`, the `docs` job build), `openspec validate v3-339-docs-sequence-lifelines --strict` and `openspec validate --specs --strict`.

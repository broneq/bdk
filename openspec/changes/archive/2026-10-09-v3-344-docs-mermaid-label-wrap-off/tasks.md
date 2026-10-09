## 1. Check first

- [x] 1.1 Extend `docs/.vitepress/diagram-fit.test.ts`: a flowchart label drawn on more lines than its source fails naming it; a block label Mermaid broke fails once naming the source label; a block label line past its block fails with the distance; labels drawn as written pass; `blockLabelLines` reads each block label line in brackets. Verify: the tests fail before the code exists.
- [x] 1.2 Extend `docs/.vitepress/diagram-fit.ts` (`diagramProblems`, in-browser measuring of label lines and block texts). Verify: the tests of 1.1 pass; `docs:diagram-fit` on the build before the fix names the two edge labels and the two block labels of #344.

## 2. Fix

- [x] 2.1 Lift Mermaid's label `max-width` in `docs/.vitepress/theme/brand.css` (design D1) and note it in `mermaid-diagram.ts`. Verify: `docs:diagram-fit` no longer names the edge labels.
- [x] 2.2 Break `[policy.gates.design = manual]`, `[batches of execution.max-parallel]` and `[not configured or invalid]` with `<br/>` (design D2). Verify: `docs:diagram-fit` passes; a temporary block label line wider than its block fails it with the distance.

## 3. Acceptance

- [x] 3.1 Check the changed diagrams in light and dark at 1280 px and 390 px (screenshots), and run the label check on every page at 390 px in the dark theme.
- [x] 3.2 Run `pnpm docs:reference`, every check of `.github/workflows/` (`pnpm check`, the `docs` job build and `docs:diagram-fit`), `openspec validate v3-344-docs-mermaid-label-wrap-off --strict` and `openspec validate --specs --strict`.

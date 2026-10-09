## 1. Reproduce

- [x] 1.1 On the dev server, run the filter audit (every element of every `.vp-doc .mermaid svg` whose computed `filter` is not `none`) on the 11 pages with a diagram. Verify: it lists the `outer-path` groups of 14 stadium nodes (guide 2, workflow 5, orchestrators 6, findings 1); the "decided" node of `concepts/findings.md` shows a shadow in light and a glow in dark.

## 2. Fix

- [x] 2.1 In `docs/.vitepress/theme/brand.css`, replace the shape-tag rule of the Diagrams section with `filter: none !important` on the diagram's `svg` and every element in it, with a comment saying why. Verify: `pnpm check` (stylelint, prettier).

## 3. Acceptance

- [x] 3.1 Re-run the audit of 1.1 in light and dark: no element listed. Look at every diagram page in light and dark at 1280 px and 390 px: the "decided" node of `concepts/findings.md` and the "fix gate" node of `concepts/orchestrators.md` draw flat, nothing else changed.
- [x] 3.2 Run `pnpm docs:reference`, every check of `.github/workflows/` (`pnpm check`, the `docs` job build), `openspec validate v3-324-docs-mermaid-stadium-shadow --strict` and `openspec validate --specs --strict`.

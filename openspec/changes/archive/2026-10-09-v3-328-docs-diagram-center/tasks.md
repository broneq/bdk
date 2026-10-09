## 1. Reproduce

- [x] 1.1 On the dev server, measure every diagram on the 11 pages with a diagram at 1280 px and 390 px, in light and dark: SVG width, inside width of the frame, space left and right. Verify: 11 diagrams narrower than their frame sit at the left padding at 1280 px (guide 1, workflow 1, orchestrators 4, cli-config-hooks 5) and 2 at 390 px.

## 2. Fix

- [x] 2.1 In `docs/.vitepress/theme/style.css`, give `.vp-doc .mermaid svg` `margin-inline: auto` with a comment on the wide case, and remove the frame's `text-align: center` and the `text-align: left` of `.vp-doc .mermaid-source`. Verify: `pnpm check` (stylelint, prettier).

## 3. Acceptance

- [x] 3.1 Re-run the measurement of 1.1: no diagram narrower than its frame is off-centre by more than 1 px, no diagram starts left of the frame padding, the diagrams that scrolled before still scroll at 390 px. Look at screenshots of the Guide and orchestrators diagrams in light and dark at 1280 px and 390 px, and at a source fallback (a diagram with a syntax error) aligning left.
- [x] 3.2 Run `pnpm docs:reference`, every check of `.github/workflows/` (`pnpm check`, the `docs` job build), `openspec validate v3-328-docs-diagram-center --strict` and `openspec validate --specs --strict`.

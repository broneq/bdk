# Tasks

## 1. Reproduce

- [x] 1.1 On the dev server, open a temporary page with a `mermaid` block that does not parse, in light and dark at 1280 px and 390 px, and measure the computed colour of the source text against the `pre` background. Verify: light below 4.5:1 (2.45:1).

## 2. Fix

- [x] 2.1 In `docs/.vitepress/theme/style.css`, give `.vp-doc .mermaid-source pre` `color: var(--vp-code-block-color)`. Verify: `pnpm check` (stylelint, prettier).

## 3. Acceptance

- [x] 3.1 Re-run the measurement of 1.1: the source text is the colour of the site's other code blocks and reads at 4.5:1 or more in light and dark at 1280 px and 390 px; look at screenshots of each. Remove the temporary page.
- [x] 3.2 Run `pnpm docs:reference`, every check of `.github/workflows/` (`pnpm check`, the `docs` job build), `openspec validate v3-333-docs-diagram-error-contrast --strict` and `openspec validate --specs --strict`.

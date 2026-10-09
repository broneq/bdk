# Design

## Context

`docs/.vitepress/theme/mermaid-diagram.ts` renders `.mermaid.mermaid-source` with an optional `p.mermaid-error` and `pre > code` holding the source. `style.css` styles that `pre` like a code block (background `--vp-code-block-bg`, code font size and line height) but sets no text colour. VitePress colours the code of its own blocks through `.vp-doc div[class*='language-'] code { color: var(--vp-code-block-color) }`, a selector the fallback does not match, so its `code` inherits `--vp-c-text-1`: dark ink in the light theme on a background that is dark in both themes. `brand.css` sets `--vp-code-block-bg: var(--bn-ink-950)` and `--vp-code-block-color: var(--bn-ink-200)` for both themes.

Measured on the dev server before the change (Chromium, 1280 px and 390 px): light 2.45:1 (`rgb(75, 81, 91)` on `rgb(10, 12, 16)`), dark 9.30:1 (`rgb(174, 179, 189)`, the dark page text, also not the code block colour). The error line above it (`--vp-c-danger-1` on the page) reads at 5.44:1 light and 7.50:1 dark, so it needs no change.

## Goals / Non-Goals

**Goals:**
- The fallback source reads like every other code block on the site, at 4.5:1 or more, in both themes.

**Non-Goals:**
- Syntax highlighting of the fallback source.
- Wide diagrams (#338), sequence lifelines (#339).

## Decisions

### D1. Use `--vp-code-block-color` on the `pre`

`.vp-doc .mermaid-source pre` gets `color: var(--vp-code-block-color)`; the `code` inherits it. This is the token VitePress uses for the text of every other code block and the one `brand.css` already pairs with `--vp-code-block-bg`, so the fallback cannot drift from the code blocks it imitates: a later change of the code block palette changes both. On `--bn-ink-950` it measures about 12:1.

Alternatives considered:
- **A design system ink token such as `--fg-on-accent` or `--bn-ink-200` directly.** Rejected: it duplicates the pairing `brand.css` already makes and would go stale if the code block colours change.
- **Make the fallback a light block in the light theme (page-surface background, page text colour).** Rejected: the fallback stands in for a code block before drawing, and every other code block on the site is dark in both themes; a block that changes look between themes is the odd one out.
- **Shiki-highlight the source.** Rejected: the source is rendered client-side by the component, so highlighting would load Shiki in the browser for a state that should be rare (a parse error is caught by `pnpm check`) or brief (before drawing). Plain text in the code block colour solves the legibility problem.

### D2. Colour on the `pre`, not on the `code`

The `pre` already owns the block's background, font size and line height, so the foreground sits with the background it is measured against. `.vp-doc` gives no colour to `pre > code` in a plain `pre`, so the `code` inherits it (verified on the dev server).

### D3. The spec states the fallback's legibility

The issue asks whether the `docs-site` spec should state it. It does, inside "Mermaid diagrams render as diagrams": the fallback is the reader-visible face of a diagram that did not draw, and a stated 4.5:1 floor in both themes keeps a later restyle from repeating this regression. The colour is stated by reference ("the colour of the site's other code blocks"), not as a value.

### D4. Checked on the rendered site, not by a unit test

As in #328 (D5): the theme tests run under happy-dom, which does not load the site's CSS cascade, so no unit test can resolve the computed colour of the fallback. The acceptance check measures computed colours on the dev server with headless Chromium on a temporary page with a broken block (not committed: `pnpm check` rejects a `mermaid` block that does not parse), in light and dark at 1280 px and 390 px.

## Risks / Trade-offs

- [VitePress renames `--vp-code-block-color`.] -> The declaration falls back to inheritance and the light theme regresses; the spec scenario names the check that would catch it.

## Migration Plan

Docs-only; the next site deploy carries it. Rollback is a revert of the PR.

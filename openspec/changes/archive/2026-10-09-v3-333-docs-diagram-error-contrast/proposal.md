# Proposal

## Why

Tracks #333.

When a `mermaid` block does not parse, and before a diagram is drawn (or without JavaScript), the site shows the block's source as `<pre><code>` inside `.mermaid.mermaid-source`. `docs/.vitepress/theme/style.css` gives that `pre` the code block background `--vp-code-block-bg`, dark in both themes, but the `code` has no Shiki highlighting and inherits the page text colour. In the light theme that is `rgb(75, 81, 91)` on `rgb(10, 12, 16)`, 2.45:1, below the WCAG AA 4.5:1 for body text: the source reads as dim grey on black, exactly when the reader needs it to see what went wrong.

## What Changes

- `.vp-doc .mermaid-source pre` in `docs/.vitepress/theme/style.css` gets `color: var(--vp-code-block-color)`, the colour VitePress gives the other code blocks on the same background (`--bn-ink-200`, `rgb(201, 205, 212)`, about 12:1), in both themes.
- The `docs-site` spec states that the source fallback reads at 4.5:1 or more in either theme.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `docs-site`: "Mermaid diagrams render as diagrams" states the legibility of the source a diagram shows when it does not draw.

## Impact

- `docs/.vitepress/theme/style.css` only. No skill, agent, hook, `bdk` command or settings key changes, so no Guide or Concepts page changes and the Reference stays as generated; the change is to how the site itself renders a broken or not yet drawn diagram.
- Out of scope: wide diagrams (#338), sequence lifelines (#339).

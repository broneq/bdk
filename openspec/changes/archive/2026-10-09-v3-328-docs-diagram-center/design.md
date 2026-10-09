## Context

The site draws each `mermaid` block with `docs/.vitepress/theme/mermaid-diagram.ts` into a `<div class="mermaid">` frame. Mermaid writes the SVG with `width="100%"` and an inline `max-width: <natural width>px`; the component adds an inline `min-width` of 60% of the natural width, so a wide diagram scrolls sideways on a phone instead of shrinking past legibility. Two stylesheets style the frame: `style.css` its layout (`overflow-x: auto`, `text-align: center`, the source fallback) and `brand.css` its look (hairline border, 24px padding, no shadows).

`text-align: center` centres inline content only. VitePress's base styles set `svg { display: block }` (computed `display: block` on the drawn SVG, checked on the dev site), so the SVG ignores it and starts at the frame's left padding. Before this Change, 11 diagrams on 4 pages sat left at 1280 px and 2 at 390 px; issue #328 counted 7 because it did not look at `concepts/cli-config-hooks.md`.

## Goals / Non-Goals

**Goals:**
- A diagram narrower than the inside of its frame sits centred in it, at every width, in both themes.
- A diagram as wide as the frame, or wider (scrolling at phone width), stays as it is, its left edge reachable.

**Non-Goals:**
- Any other change to how a diagram is drawn or sized. Sequence diagram participant names that break at a hyphen are #332.

## Decisions

### D1. Centre the SVG with `margin-inline: auto`

`.vp-doc .mermaid svg` gets `margin-inline: auto`. For a block box narrower than its container the two auto margins split the free space equally. For a box wider than its container CSS resolves the over-constrained auto margins to 0 (CSS 2.1 10.3.3, left-to-right), so a diagram held wider than the frame by its `min-width` keeps starting at the left padding and scrolls with its left edge reachable, exactly as before.

Alternatives considered:
- **Flex or grid on the frame with `justify-content: center`.** Rejected: an item wider than a centring flex container overflows on both sides and its left part cannot be scrolled to; `safe center` avoids that but adds a layout mode to a frame that only holds one block, for the same result.
- **`display: inline-block` on the SVG so the existing `text-align: center` applies.** Rejected: an inline box sits on a line box and gains descender space under it, and it makes the frame's layout depend on inherited text alignment instead of saying what it means.
- **A wrapper element in `mermaid-diagram.ts`.** Rejected: more markup for what one CSS declaration does, in the file #332 changes in parallel.

### D2. The rule lives in `style.css`, not in `brand.css`

The issue's Scope names the Diagrams section of `brand.css`. The placement of the diagram in its frame is layout, next to the frame's `overflow-x: auto` and the SVG's `max-width` in `style.css`; `brand.css` holds the design system's look (border, padding, no shadows). Keeping the layout in one file keeps the two rules that decide where a diagram sits (`overflow-x` and the margins) side by side. It also keeps this Change out of the files #332 changes.

### D3. Remove the frame's `text-align: center` and its undo

`text-align: center` on the frame never centred the SVG, and its only other effect was on the source fallback, which `.vp-doc .mermaid-source { text-align: left; }` undid. Both go: leaving a rule that looks like it centres the diagram next to the one that does would mislead the next reader. The fallback's text then aligns left by inheritance, as it does today.

### D4. The spec states the alignment

The issue asks whether the `docs-site` spec should state it. It does: "Mermaid diagrams render as diagrams" already states how a diagram looks in the site (labels, shadows), and alignment is part of the same reader-visible contract, with the scroll case stated next to it so a later "centre" fix cannot cut off the left edge of a wide diagram.

### D5. Checked on the rendered site, not by a unit test

As in #324: tests run Mermaid under happy-dom, which has no layout, so no test in `pnpm check` can measure where a drawn SVG sits. The acceptance check is a measurement on the dev server with headless Chromium: on all 11 pages with a diagram, at 1280 px and 390 px, in light and dark, every SVG narrower than its frame's inside must have equal space left and right (within 1 px), and no SVG may start left of the frame's padding.

## Risks / Trade-offs

- [Mermaid stops writing `width="100%"` and an inline `max-width`.] -> The SVG then sizes from its `width` attribute; `margin-inline: auto` still centres a block box of any definite width, so the rule keeps holding.

## Migration Plan

Docs-only; the next site deploy centres the narrow diagrams. Rollback is a revert of the PR.

## Context

The site draws diagrams with Mermaid 12 in the `base` theme and the `neo` look (`docs/.vitepress/theme/mermaid-diagram.ts`). Mermaid writes a `<style>` into each SVG that sets `filter: <dropShadow>` on several selectors: `[data-look="neo"].node rect, polygon, circle`, `.node .outer-path` (the group around a stadium node's path), icon shapes, and gitGraph commits; the sequence diagram sets a fixed `drop-shadow` on its actor popup menu. `brand.css` turned it off with `.vp-doc .mermaid svg :is(rect, polygon, path, circle, ellipse) { filter: none !important; }`, which misses the `outer-path` group: 14 stadium nodes on 4 pages still drew a shadow, a glow on the dark theme.

The design system draws no shadows on content (the site sets `--vp-shadow-1/2: none`); the Diagrams section of `brand.css` already says "no shadows on the shapes".

## Goals / Non-Goals

**Goals:**
- No element of any diagram on the site draws a shadow or glow, in either theme, for every node shape and diagram type.
- The rule keeps holding when Mermaid moves the filter to another element in a later version.

**Non-Goals:**
- Any other change to how diagrams look.

## Decisions

### D1. Reset `filter` on every element of a drawn diagram in `brand.css`

The rule becomes `.vp-doc .mermaid svg, .vp-doc .mermaid svg * { filter: none !important; }`. `!important` in the page stylesheet wins over Mermaid's in-SVG `<style>` and over inline `style` attributes without `!important`.

Alternatives considered:
- **Add `g.outer-path` (or `.outer-path`) to the tag list.** Rejected: it fixes the selector Mermaid uses today and fails again on the next one; the list already missed one in Mermaid 12, and Mermaid sets the filter on icons, gitGraph commits and the sequence popup too.
- **Set the theme variable `dropShadow: "none"` in `mermaid-diagram.ts`.** Mermaid then writes `filter: none` itself, which is the cleanest source. Rejected as the only fix: it covers only the filters derived from `dropShadow`, not the fixed ones such as the sequence popup's, and a later Mermaid version can add more. Kept out as a second mechanism too: with the CSS rule in place it changes nothing the reader sees, and two places doing one job is the kind of drift that caused this bug.
- **Strip `filter` from the SVG string after `mermaid.render`.** Rejected: string surgery on generated markup, and it does not cover inline styles set later.

A diagram on the site uses no filter for anything but shadows, so turning all filters off loses nothing.

### D2. Checked on the rendered site, not by a unit test

Tests run Mermaid under happy-dom, where `mermaid.render` returns an empty SVG (no layout engine; measured again for this Change), so no test in `pnpm check` can see the computed style of a drawn node. Adding a headless browser to `pnpm check` for one CSS rule is out of proportion. The acceptance check is an audit of the rendered site: a script on the dev server lists every element of every diagram whose computed `filter` is not `none`, on all 11 pages with a diagram, in light and dark; before the fix it lists the 14 stadium nodes, after it lists none.

## Risks / Trade-offs

- [A future diagram that wants a filter (say a blur) cannot have one.] -> The design system has no such effect; if one is ever wanted, the rule is the one place to change.

## Migration Plan

Docs-only; the next site deploy draws the diagrams flat. Rollback is a revert of the PR.

# Proposal

## Why

Tracks #304.

The docs theme (`docs/.vitepress/theme/brand.css`, "Tables") draws a table's strong 2px top rule on the table box. VitePress renders every table as `display: block` so a wide one scrolls, and the block box always spans the whole content column while the rows shrink to their content. On a table narrower than the column, such as the wave table of `docs/concepts/stages.md` ("How a plan is cut"), the top rule runs across the column and the hairline row rules stop at the last column. Measured on the local site: the box is 688px wide, the rows 380px.

## What Changes

- The top rule moves from the table box to the cells of the table's first row, so it is exactly as wide as the rows, in the light and the dark theme (design D1).
- Wide (scrolling) tables look as before: their rows already fill the box.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `docs-site`: the requirement "The site follows the Broniszewski design system" gains a scenario for a table narrower than the content column.

## Impact

- Code: `docs/.vitepress/theme/brand.css` ("Tables").
- User docs: no page text changes; every table of the site renders its top rule as wide as its rows. Nothing a BDK user sees in a plugin (skill, agent, hook, `bdk` command, settings key) changes, so the Change has no Docs task group and the Reference is unchanged.
- Not in scope: Mermaid label wrapping in the same theme (#308).

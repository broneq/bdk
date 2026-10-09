## Why

Tracks #324.

Mermaid 12 (`mermaid@12.1.0`, `neo` look) gives the shapes of a node a CSS `filter` from its theme's `dropShadow` value, `drop-shadow(1px 2px 2px rgba(185,185,185,1))` in the `base` theme the site uses. `docs/.vitepress/theme/brand.css` resets the filter only on five shape tags (`rect`, `polygon`, `path`, `circle`, `ellipse`), while Mermaid also sets it on the `<g class="... outer-path">` group that holds a stadium node's shape. So stadium nodes keep a grey shadow, which reads as a light glow on the dark theme. Measured on the local site before this Change: 14 nodes on 4 pages (`guide/index.md` 2, `concepts/workflow.md` 5, `concepts/orchestrators.md` 6, `concepts/findings.md` 1).

## What Changes

- `brand.css` resets `filter` on every element of a drawn diagram, not on a list of shape tags, so no node shape, group or later Mermaid element draws a shadow or glow, in either theme.
- The `docs-site` spec states that a diagram draws no shadow or glow.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `docs-site`: "Mermaid diagrams render as diagrams" gains the rule that no element of a diagram draws a shadow or glow, with a scenario for the stadium node.

## Impact

- Code: `docs/.vitepress/theme/brand.css` (Diagrams section).
- It changes nothing a BDK user sees in a skill, agent, hook, `bdk` command, settings key or the flow between them: only how the docs site draws diagrams. So the Change has no Docs task group, and the Reference is unaffected.

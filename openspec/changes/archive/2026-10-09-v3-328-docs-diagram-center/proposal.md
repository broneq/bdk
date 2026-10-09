## Why

Tracks #328.

A diagram narrower than its frame sits against the frame's left edge with empty space to its right. `docs/.vitepress/theme/style.css` asks for centring with `text-align: center` on the `.mermaid` frame, but the drawn SVG is a block box (VitePress's base styles set `svg { display: block }`), so the rule never applies. Measured on the local dev site before this Change: at 1280 px, 11 diagrams on 4 pages start at the left padding (`guide/index.md` 1, `concepts/workflow.md` 1, `concepts/orchestrators.md` 4, `concepts/cli-config-hooks.md` 5); at 390 px, 2 (`guide/index.md`, `concepts/workflow.md`).

## What Changes

- The drawn SVG of a diagram gets `margin-inline: auto`, so a diagram narrower than its frame sits centred in it. A diagram as wide as the frame fills it as before, and a diagram wider than the frame (its `min-width` at phone width) still starts at the frame's left edge and scrolls sideways.
- The `text-align: center` of the frame, which never centred anything, and the `text-align: left` that undid it for the source fallback go.
- The `docs-site` spec states where a diagram sits in its frame.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `docs-site`: "Mermaid diagrams render as diagrams" gains the rule that a diagram narrower than its frame sits centred in it and a wider one scrolls with its left edge reachable, with a scenario for each.

## Impact

- Code: `docs/.vitepress/theme/style.css` (the layout of the `.mermaid` frame). `brand.css`, named in the issue's Scope, keeps only the frame's look; see design.md D2.
- Out of scope: sequence diagram participant names that break at a hyphen (#332).
- It changes nothing a BDK user sees in a skill, agent, hook, `bdk` command, settings key or the flow between them: only where the docs site places a diagram. So the Change has no Docs task group, and the Reference is unaffected.

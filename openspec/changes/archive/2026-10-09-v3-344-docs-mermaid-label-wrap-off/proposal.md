## Why

Tracks #344.

The `docs-site` spec says a flowchart label and a sequence block label break into lines only where their author wrote `<br/>`. Two Mermaid 12.1 paths still break them at a space of Mermaid's choosing:

- An edge label: `insertEdgeLabel` calls `createText` without a width, so its HTML div gets the default `max-width: 200px`, and a line wider than 200 px wraps. On the site `archived, openspec/ uncommitted` (`docs/concepts/orchestrators.md`, `/bdk:close`) and `Agent bdk:lead + stage skill, background` (`docs/design/2026-10-07-v3-architecture.md`, D1 B) show on two lines. `flowchart.wrappingWidth` (#308) covers node labels only.
- A sequence block label (`alt`, `else`, `loop`, `opt`, `par`, `and`, ...): `adjustLoopHeightForWrap` runs `wrapLabel` on it with the block's width whatever `sequence.wrap` says, unless the label already holds a `<br/>`. `[policy.gates.design = manual]` (architecture design) and `[batches of execution.max-parallel]` (`orchestrators.md`) are broken today. No Mermaid option turns this off.

The 40-character limit of the mermaid blocks test does not catch either: the width depends on the font and, for a block label, on the block, so it shows only in a browser.

## What Changes

- `docs/.vitepress/theme/brand.css` lifts the `max-width` Mermaid puts on its HTML label divs. Mermaid measures a label inside the page, so the layout makes room for the label on the lines its author wrote.
- `docs:diagram-fit` (the browser check of #338) also fails when a drawn flowchart label shows a different number of lines than its source has, when a drawn sequence block label line is no line of its source (Mermaid broke it because it is wider than its block), and when a block label line runs past its block's frame. It names the page, the block's line and the label.
- The block labels Mermaid breaks today get an author `<br/>`: the two above and `[not configured or invalid]` (`docs/concepts/cli-config-hooks.md`, broken since the redraw of #340).

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `docs-site`: "Mermaid diagrams render as diagrams" names edge labels and adds a scenario for them; a new requirement "Drawn labels keep their author's lines" makes the `docs` job check it.

## Impact

- Code: `docs/.vitepress/theme/brand.css`, `docs/.vitepress/diagram-fit.ts` and its test, a comment in `docs/.vitepress/theme/mermaid-diagram.ts`.
- Docs content: one block label each in `docs/concepts/orchestrators.md`, `docs/concepts/cli-config-hooks.md` and `docs/design/2026-10-07-v3-architecture.md` gains a `<br/>`.
- It changes nothing a BDK user sees in a skill, agent, hook, `bdk` command, settings key or the flow between them, so the Change has no Docs task group and the Reference is unaffected. No skill changes.

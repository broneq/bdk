## Why

Tracks #339.

On the docs site, the lifelines and frame lines of sequence diagrams run through the letters of message labels. Mermaid draws message, frame-condition and section texts with no background, and every lifeline and frame line (`par`, `alt`, `loop`, `opt` borders and the dashed section dividers) under or over them, so a lifeline lying between the two ends of a message, or under a self-message label, strikes through it. Flowcharts do not have the defect: their edge labels sit on `edgeLabelBackground`. Measured on the rendered site before this Change (own dev server, Chromium), with the label letters hidden and the pixels inside each label's text box compared to the page background: 105 of 218 message, frame-condition and section-title labels on the 14 sequence diagrams of 5 pages carry line pixels at 1280 px, 131 at 390 px, the same in the light and the dark theme. Only the Hooks diagram of `concepts/cli-config-hooks.md` is clean at 1280 px.

## What Changes

- After Mermaid draws a sequence diagram, the site's diagram component gives every message text, frame condition text and section title a backing rectangle in the page background colour of the current theme, and lifts these labels above every line of the diagram. Lines then pass behind a label, never through it, in both themes and at every width.
- Flowcharts and the texts that already sit on a filled box (participant names, notes, the `par`/`alt`/`loop` label tab) are left as they are.
- The `docs-site` spec states that no line of a drawn diagram runs through the text of a label (the issue's "To resolve in the spec": yes, it does).
- No diagram source changes.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `docs-site`: "Mermaid diagrams render as diagrams" adds that no lifeline, message line or frame line of a sequence diagram runs through the letters of a label, with a scenario.

## Impact

- Code: a new `docs/.vitepress/theme/label-backing.ts` with its test, called from `docs/.vitepress/theme/mermaid-diagram.ts` after a sequence diagram is drawn; the backing colour in the Diagrams section of `docs/.vitepress/theme/brand.css`.
- It changes nothing a BDK user sees in a skill, agent, hook, `bdk` command, settings key or the flow between them, so the Change has no Docs task group; the Reference is unaffected. Only the look of the site's diagrams changes.
- Out of scope: redrawing diagrams wider than the column (#338) and centring narrow diagrams (#328), both in `mermaid-diagram.ts` in parallel; this Change adds one call after the render and merges `origin/staging/v3` before the PR.

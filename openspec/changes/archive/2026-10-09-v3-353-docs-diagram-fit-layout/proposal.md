# Proposal

## Why

Tracks #353.

`pnpm --filter @bdk/docs docs:diagram-fit` (#338) passes the last diagram of most pages unchecked. It waits until a page has as many `.mermaid svg, .mermaid-error` elements as `mermaid` blocks, but a frame still being drawn already holds Mermaid's scratch SVG (inside `#dmermaid-*`, the element `mermaid.render` sizes labels in). That SVG has no `viewBox`, so the check reads a natural width of 0, a scale of `Infinity`, which is not below 0.8, and the diagram passes. Reproduced on this branch: the last diagram of `concepts/agents`, `concepts/findings`, `concepts/run-state` and `concepts/workflow` is measured from the scratch SVG of a frame that still has the class `mermaid-source`.

## What Changes

- The check waits until every diagram frame of a page is drawn: the frame no longer shows its source and its own SVG has a non-zero `viewBox` width, or it shows its error. After a timeout it measures what it has instead of throwing.
- It measures only the drawn SVG of a frame (the frame's own child), never Mermaid's scratch SVG.
- A diagram it cannot measure (no drawn SVG, or a zero or missing `viewBox` width) fails and names the page and the block's line.
- A block that shows a Mermaid error fails and names the page, the block's line and the error, instead of the page-level "N mermaid blocks, M drawn diagrams" line.
- Unit tests in `docs/.vitepress/diagram-fit.test.ts` for both.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `docs-site`: "Diagrams fit the content column" states that a diagram the check cannot measure, or that does not draw, fails the check (resolves the issue's "To resolve in the spec").

## Impact

- `docs/.vitepress/diagram-fit.ts`, `docs/.vitepress/diagram-fit.test.ts`; `openspec/specs/docs-site/spec.md`.
- No change a BDK user sees: docs-site tooling only, no skill, agent, hook, `bdk` command or settings key changes, so no Guide or Concepts page changes and no Docs task group.
- `theme/mermaid-diagram.ts` is unchanged: the check reads the frame state the component already shows.
- #344 also touched `diagram-fit.ts`; it is merged, and this Change builds on it.

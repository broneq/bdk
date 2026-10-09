# Design

## Context

`diagram-fit.ts` opens each page with a diagram in Chromium, waits for `.mermaid svg, .mermaid-error` to reach the block count, then reads each `.mermaid` frame's first `svg`. The `Mermaid` component (`theme/mermaid-diagram.ts`) renders a frame as `div.mermaid.mermaid-source` (source code, plus `p.mermaid-error` on a failure) until the diagram is drawn, then as `div.mermaid` with the SVG as its child. `mermaid.render(id, source, root)` lays the diagram out in a scratch `div#d<id>` inside that same frame, with an SVG that has no `viewBox` yet. That scratch SVG satisfies the wait and is what the check measures: width 0, scale `Infinity`, a pass.

## Goals / Non-Goals

**Goals:**
- Every diagram is measured after its layout, and the check reads a finite scale for each.
- A diagram the check cannot measure, or that does not draw, fails with its page and line.

**Non-Goals:**
- Changing how a diagram is drawn or sized (`minScale`, Mermaid configuration).
- The 390 px phone check (unchanged).

## Decisions

### D1. Wait for the frame's drawn state, read from the frame itself

The wait is: as many `.mermaid` frames as blocks, and each frame either shows `.mermaid-error` or is not `.mermaid-source` and has a child `svg` (`:scope > svg`) with a `viewBox` width above 0. The component sets the drawn SVG, its `min-width` and its sequence label backing in one microtask chain after Vue's flush, and `waitForFunction` polls between tasks, so a frame seen as drawn is complete.

Alternatives: a fixed delay (the issue's 1.5 s re-read) - lost: slow and still a race on a slow runner. A `data-drawn` attribute set by the component - lost: it adds a test hook to the component for state the frame's class already shows; the check already depends on the component's class names.

### D2. A timeout measures instead of throwing

`waitForFunction` gets an explicit 30 s timeout; on timeout the check measures the page as it is, so a frame that never draws becomes a named finding (D3) rather than a stack trace with no page line. Alternative: let the timeout throw - lost: it names neither the block nor its line, and stops the check before the other pages.

### D3. One measured entry per frame; unmeasurable and error frames are findings

`measureDiagrams` returns one entry per `.mermaid` frame, in page order: the drawn SVG's widths and labels, `naturalWidth` 0 when the frame has no drawn SVG, and the error text for a frame that shows one. `diagramProblems` reports `<page>:<line>: not laid out, so its fit cannot be measured` for a natural width that is not a positive finite number, and `<page>:<line>: does not draw: <error>` for an error, and skips the fit and label checks for both. The page-level count line stays for a page whose frame count differs from its block count. Alternative: keep dropping frames without an SVG and rely on the count line - lost: it names no block, and the issue asks for the page and line.

## Risks / Trade-offs

- A page whose diagram legitimately takes over 30 s to draw would fail; Mermaid draws every site diagram in well under a second, so this flags a real problem.
- The check depends on the component's `mermaid-source` class and `.mermaid-error`; a rename in the component breaks the wait, which then times out and fails loudly (D2, D3), never passes silently.

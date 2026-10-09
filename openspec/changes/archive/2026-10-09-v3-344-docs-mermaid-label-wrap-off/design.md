## Context

#308 set `flowchart.wrappingWidth: 10000` and #332 `sequence.wrap: false` in `docs/.vitepress/theme/mermaid-diagram.ts`, so node labels and sequence texts break only at `<br/>`. Two Mermaid 12.1 paths ignore both settings (read in `node_modules/mermaid/dist/chunks/mermaid.core/`):

- `insertEdgeLabel` calls `createText(..., { width: undefined })`; `createText` defaults `width` to 200 and `addHtmlSpan` sets `max-width: 200px` on the label div. If the measured div is exactly 200 px wide, it also sets `white-space: break-spaces` and `width: 200px`, so the label wraps. `addHtmlSpan` creates and measures the label as a child of the edge labels group and only then moves it under its `g.edgeLabel`.
- `adjustLoopHeightForWrap` (sequence renderer) runs `wrapLabel("[label]", loopWidth - 2 * wrapPadding)` on every block and section label and sets `wrap = true`. `wrapLabel` returns a label that holds a `<br/>` unchanged; any other label wider than the block breaks at a space, and a word wider than the block is cut with a hyphen (`breakString`). `loopWidth` comes from the messages inside the block. `wrapPadding` also pads every other sequence text, so it cannot be set out of the way.

Measured on the built site at 1280 px (Chromium) before this Change: the two edge labels named in #344 show on two lines; the block labels `[policy.gates.design = manual]` and `[batches of execution.max-parallel]` are broken by Mermaid; no node label is re-broken.

## Goals / Non-Goals

**Goals:**
- Every drawn label of a site diagram shows the lines its author wrote.
- The `docs` job fails, naming the label, when one does not.

**Non-Goals:**
- Diagram content (#340) and error contrast (#333).
- Diagram types the site does not use.

## Decisions

### D1. Edge labels: lift the cap in the stylesheet

`brand.css` sets `max-width: none !important` on `.vp-doc .mermaid foreignObject > div`. Mermaid renders into a scratch element inside the diagram's frame (`mermaid.render(id, source, root)`), so the rule applies while Mermaid measures; the measured width is never 200 px, so Mermaid keeps `white-space: nowrap` and sizes the edge for the whole line. The rule matches every HTML label div, not only `.edgeLabel` ones, because the label is measured before Mermaid moves it under `g.edgeLabel`; node labels already have a 10000 px cap, so they do not change.

Alternatives considered:
- **A Mermaid option.** None exists: the edge label width is hard-coded to `undefined` in `insertEdgeLabel`, `markdownAutoWrap` only affects markdown strings, and `wrappingWidth` is read for nodes only.
- **A `<br/>` in every long edge label.** Rejected: it leaves the 200 px rule in place for every future label and makes authors guess Mermaid's text width.
- **Patching Mermaid (`pnpm patch`).** Rejected: a stylesheet rule reaches the same result without a patch to a hashed chunk file that every Mermaid upgrade must redo.

### D2. Block labels: Mermaid keeps the decision, the check fails on it

Mermaid offers no way to stop it re-breaking a block label wider than its block, and a label left unbroken would run past the block's frame anyway (Mermaid does not widen a block for its label). So the label's author must break it with `<br/>`, as #338 did for `[blocked,<br/>questions: stop]`, and the check makes that visible: `docs:diagram-fit` reads the block labels from the source (`alt`, `else`, `loop`, `opt`, `par`, `par_over`, `and`, `critical`, `option`, `break`), each line in brackets as Mermaid draws it, and fails on a drawn `loopText` or `sectionTitle` line that is no source line, naming the source label once. It also fails when a line kept as written runs past the inside of the innermost block frame around it (past the frame's sides, or on the top row past the `alt`/`loop` tab), with 4 px kept free on each side: the text's backing box (`label-backing.ts`) reaches 4 px past the letters and would hide the frame line.

Alternatives considered:
- **Patching `adjustLoopHeightForWrap`.** Rejected: an unwrapped label would run past its block, which is the same defect drawn differently, and the patch must be redone on every upgrade.
- **A check in the mermaid blocks test (happy-dom).** Rejected: Mermaid needs a browser layout to size a block; happy-dom has none.

### D3. One browser pass checks fit and labels

The label check runs in `docs:diagram-fit` (#338), which already opens every page with a diagram in Chromium at 1280 px. `fitProblems` becomes `diagramProblems`, which gets the blocks (line and source) and returns fit problems and label problems. A flowchart label's drawn line count is the number of vertically separate text boxes of its text nodes (`Range.getClientRects`): the label div's height is not, because inline code and padding make it taller than its lines. Its source line count is its `<br>` elements plus one. The script and the CI job keep their names: the job already runs it, and the spec requirement says what it checks. Theme and width do not change label layout (Mermaid lays out at the diagram's own size and the SVG scales); a run at 390 px in the dark theme found no label problem either.

## Risks / Trade-offs

- [The block label parser reads statements by keyword, not by Mermaid's grammar] → It only decides whether a drawn line is a source line; a flowchart line that starts with `and` adds an unused entry, never a false failure. A missed statement form would show as a failure naming the drawn line, not pass silently.
- [Mermaid changes its class names (`loopText`, `sectionTitle`, `labelBox`, `data-et="control-structure"`) in an upgrade] → The check would find no block texts and pass; the unit tests pin the comparison, and an upgrade PR is checked by eye on the diagram pages (spec scenarios).

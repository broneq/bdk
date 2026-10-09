## Context

`docs/.vitepress/theme/mermaid-diagram.ts` draws each `mermaid` block with Mermaid 12.1 (`theme: "base"`, colours from the design system tokens in `brandVariables()`) and inserts the SVG with `innerHTML`; a theme switch draws it again. Flowchart edge labels sit on `edgeLabelBackground`; sequence diagrams have no such option.

What Mermaid's sequence renderer (`sequenceDiagram-*.mjs`, `drawLoop`, `drawMessage`) draws, in document order, measured on the site's SVG:

1. one group per participant with its lifeline (`line.actor-line`) and box;
2. one group per frame (`g[data-et=control-structure]`): the four border lines and the dashed section dividers (`line.loopLine`), the label tab (`polygon.labelBox` + `text.labelText`), the condition (`text.loopText`, with a `tspan`) and the section titles (`text.sectionTitle`);
3. notes (`rect.note` + `text.noteText`);
4. each message as `text.messageText` followed by its line (`line.messageLine0/1`).

The texts have no background, so every lifeline drawn before them shows through, and the lines of a later frame group could be drawn over an earlier frame's texts. Participant names, notes and the label tab sit on filled boxes and are not affected. A `text.loopText` box ends 0.6 user units below its frame's top border, and a message text box ends about 12 units above its own line.

Baseline (see proposal): 105 of 218 labels crossed at 1280 px, 131 at 390 px, in both themes.

## Goals / Non-Goals

**Goals:**
- No lifeline, message line, frame border or section divider is visible through the letters of a message, frame condition or section title, in either theme, at any width, for every sequence diagram the site has now or gets later.
- No change to flowcharts and no change to any diagram source.

**Non-Goals:**
- Diagrams wider than the column (#338) and centring narrow diagrams (#328).
- Other diagram types: the site has only flowcharts and sequence diagrams.

## Decisions

### D1. A backing rectangle per label, after the render

After a sequence diagram is drawn, `backSequenceLabels(svg)` (new module `docs/.vitepress/theme/label-backing.ts`) puts a `rect.label-backing` behind each `text.messageText`, `text.loopText` and `text.sectionTitle`: the text's `getBBox()` (font ascent to descent, about 4 units above the cap height and 5 below the baseline at 16 px) widened by 4 units on each side, no vertical padding. A lifeline then stops at a clean box edge around the text and continues on the other side, the same look as a flowchart edge label on `edgeLabelBackground`.

Alternatives considered:
- **SVG text halo (`paint-order: stroke` with a stroke in the page colour), pure CSS.** Rejected: it clears only a few pixels around each glyph, so a lifeline stays visible in the space above short letters and between words inside the label, and a halo wide enough to hide that (about 4 px) reaches the frame border 0.6 units above a `loopText`, cutting gaps into it. It also leaves the paint order problem of D2.
- **A Mermaid option.** Rejected: Mermaid 12.1 has no background option for sequence texts (`edgeLabelBackground` applies to flowcharts only).
- **Move participants or set `messageAlign` per diagram.** Rejected: 13 of 14 diagrams are affected and any later diagram would be again; a message between two non-adjacent participants always spans the lifelines between them.
- **An SVG filter with `feFlood` as background.** Rejected: filter padding is relative to the text's size, so the margin differs per label, and the site resets every `filter` on diagram elements to remove shadows (`brand.css`).

### D2. The backed labels move to a top layer

Each backed label moves, with its rectangle, into one group appended last to the SVG, so no line can paint over it whatever order Mermaid draws in (a later frame group, a message line). The group the text leaves keeps everything else. If an ancestor of the text carries a `transform` (Mermaid's sequence output has none today), the label's holder group repeats the ancestors' transforms, outermost first, which is how SVG composes nested transforms, so the text stays where Mermaid put it.

Alternative: insert the rectangle right before the text in place. Rejected: a line drawn after the text's group (another frame's border) would still strike through it; correctness would depend on Mermaid's draw order.

### D3. The backing colour comes from the page token in CSS

`brand.css` fills `.label-backing` with `var(--bg-page)`, the colour behind every diagram (no diagram sits in a coloured container) and the colour `brandVariables()` gives `edgeLabelBackground`. A CSS rule, not an attribute set from JavaScript, keeps the colour bound to the theme's token. No Mermaid style rule matches the class.

### D4. Only sequence diagrams are processed

The component calls `backSequenceLabels` only when the drawn SVG has `aria-roledescription="sequence"`, which Mermaid sets per diagram type. Flowcharts keep Mermaid's own label backgrounds and stay byte-identical.

### D5. Proof: a unit test plus a pixel audit of the rendered site

The test (happy-dom, `getBBox` stubbed) fixes the structure: each of the three label kinds gets a rectangle sized from its box, label and rectangle sit in a layer after every line, ancestor transforms carry over, other texts stay untouched. happy-dom does no layout, so the visible result is proven on the rendered site: in Chromium, for every sequence diagram, the label letters are hidden and the pixels inside each label's text box (inset 2 units vertically, the part that holds the letters) are compared to the page background, in light and dark at 1280 px and 390 px, with the frame's clip lifted so a diagram that scrolls sideways is checked whole; after this Change it reports 0 of 218 labels in each of the four runs; screenshots of every diagram are reviewed. A browser check in `pnpm check` was considered and rejected: CI has no browser, and adding one for one look-only property costs more than a review of screenshots at the rare changes of this component.

## Spec decision (issue: "To resolve in the spec")

Yes: "Mermaid diagrams render as diagrams" states that no lifeline, message line or frame line of a drawn sequence diagram is visible through the letters of a message, frame condition or section title, with a scenario on the Execute diagram of `concepts/run-state.md`.

## Risks / Trade-offs

- [A Mermaid upgrade renames the text classes or adds new label kinds.] -> The unit test pins the classes the module handles; the audit of D5 runs against the rendered output, and the spec scenario names a diagram to look at.
- [A label's backing hides a short piece of a line: the arrow line of another message, if one ever ran inside a label box.] -> Measured: a message line is about 12 units below its text box and no other line lies inside a box except lifelines and frame lines, which are meant to pass behind.
- [#328 and #338 change `mermaid-diagram.ts` in parallel.] -> This Change adds one call after the SVG is in the DOM; the branch merges `origin/staging/v3` before the PR and again before the merge.

## Migration Plan

None: a docs-site look change, live with the next site deploy.

## Open Questions

None.

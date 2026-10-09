## Context

`docs/.vitepress/theme/mermaid-diagram.ts` draws every `mermaid` block in the browser with `mermaid.initialize` and no `flowchart` section, so flowcharts use Mermaid 12's `flowchart.wrappingWidth` default of 120 px. Mermaid measures each label line; a line wider than the width gets `max-width: <width>px` and `white-space: break-spaces`, and the browser then breaks it at the last break opportunity that fits. A hyphen followed by a letter is such an opportunity, so names split inside a word. #307 set `wrappingWidth: 200` on two flowcharts of `docs/concepts/orchestrators.md`.

Measured on the rendered site (local dev server, Chrome, light theme, 1280 px), before this Change: 33 mid-word splits in 19 flowcharts of `docs/concepts/` and `docs/design/`. The widest unbreakable token in any flowchart label is `R/close/spec-conformance.md` at 199 px, and the widest authored label line is 424 px (66 characters).

## Goals / Non-Goals

**Goals:**
- No flowchart label on the site splits inside a word, now or when a page adds a longer name later.
- One flowchart wrapping setting for the whole site.
- Diagrams stay about as wide as before.

**Non-Goals:**
- Sequence diagrams: their layout comes from the `sequence` init lines of each block and does not wrap labels this way; they stay as they are.
- Restyling diagrams or changing their content beyond line breaks.

## Decisions

### D1. Turn automatic wrapping off instead of choosing a wider width

`mermaid.initialize` gets `flowchart: { wrappingWidth: 10000 }`, a width no label line reaches, so Mermaid never sets `break-spaces` and a label breaks only at its `<br/>`.

Alternatives considered:
- **A width of about 200 px, as the issue suggests.** Rejected: measured, a 240 px width still split `npx -y lavish-axi --|version` and `writes R/close/spec-|conformance.md`. Any line longer than the width can break after a hyphen, so no width is safe; 200 px also sits 1 px over the widest token, so the next longer name would split again.
- **Stop the browser from breaking after a hyphen with CSS.** Rejected: CSS has no property that removes the break opportunity after a literal hyphen (`hyphens` and `word-break: keep-all` do not affect it).
- **Rewrite `-` to a non-breaking hyphen (U+2011) or add word joiners before drawing.** Rejected: copied text would no longer match the command or name the reader copies, and Geist may not have the glyph, so it would draw in a fallback font.

The issue's Goal ("labels wrap only where the author breaks them") is exactly this behaviour.

### D2. A 40-character limit per label line, checked by `pnpm check`

With wrapping off, a long authored line makes a wide node. The `mermaid blocks` test (already part of `pnpm check`) parses every flowchart of a site page, takes each node, edge and subgraph label, splits it at `<br/>`, decodes HTML entities, and fails on a line longer than 40 characters, naming the page, the block's line and the line.

- 40 characters is about 260 px of 14px Geist: as wide as the widest node the site drew before, wide enough for every token, and only 13 existing lines pass it (broken by hand in this Change at word boundaries).
- Alternatives: a tighter limit (32) would rewrap 46 lines for little width gain, since most growth comes from 18-26-character lines that wrapped at 120 px before and now fit on one line; no limit leaves width to review by eye, which #307 shows slips. Measuring pixel widths in the test would need the font and a layout engine in Node; characters are a stable proxy and the limit is far from the 10000 px width, so the proxy cannot cause a split.

### D3. No per-diagram `wrappingWidth`

The same test fails on a `mermaid` block whose source contains `wrappingWidth`, so the site keeps one value (the issue's "one value for all flowcharts"). The two #307 init lines go; the `sequence` init lines stay, as they set layout, not wrapping.

### D4. Read the labels from mermaid's parsed diagram

The test reads node, edge and subgraph labels from the diagram's database (`mermaid.mermaidAPI.getDiagramFromText`), the only public way to get them parsed exactly as the site draws them; the call carries the repository's one `@typescript-eslint/no-deprecated` exception, with the reason next to it.

Alternatives: `mermaid.render` under happy-dom returns an empty SVG (no layout engine); `mermaid.parse` returns only the diagram type; a regex over the source misses unquoted labels and `-- text -->` edges. If mermaid drops the API, the test fails loudly and the fix stays in the test file.

## Risks / Trade-offs

- [Some diagrams get wider: a line that wrapped at 120 px now shows on one line (`concepts/agents` 833 to 952 px viewBox, `concepts/findings` 885 to 1019 px).] -> The component already shrinks a diagram to the column down to 60% and scrolls it sideways below that; the labels now read whole, which is the point. The audit after the change checks no page scrolls horizontally as a whole.
- [Character count is not pixel width.] -> It only bounds node width; correctness (no mid-word split) comes from D1 and does not depend on it.

## Migration Plan

Docs-only; the next site deploy draws the diagrams with the new setting. Rollback is a revert of the PR.

## Context

`docs/.vitepress/theme/mermaid-diagram.ts` draws every `mermaid` block with one `mermaid.initialize`; since #308 it turns flowchart wrapping off and `docs/.vitepress/mermaid-parse.test.ts` holds flowchart label lines to 40 characters. Sequence diagrams were left out (#308 design, Non-Goals).

Mermaid 12.1 sequence diagrams wrap a text only when `wrap` is on for it (`sequence.wrap`, a top-level `wrap` init key, the `%%{wrap}%%` directive or a `wrap:` text prefix). Then `utils.wrapLabel` fits the text into the actor or message width, and `breakString` cuts any single word wider than that width into chunks, appending `-` to each but the last. With wrapping off, a participant box grows to fit its name and a message line is drawn whole; text breaks only at `<br/>`.

Measured on the rendered site (dev server, Chromium, light theme, 1280 px), before this Change: 11 sequence diagrams on 5 pages. The three that set `"wrap": true` (`docs/concepts/orchestrators.md`, `/bdk:review-round`, `/bdk:pr-review`, `--verify`) cut `/bdk:pr-review` (four participant boxes), `/bdk:pr-review-round`, `execution.max-parallel` and `round-N/review.md` inside the word; the other eight cut nothing. Read from the parsed diagrams, 17 sequence text lines are longer than 40 characters, the longest 60.

## Goals / Non-Goals

**Goals:**
- No text of a sequence diagram on the site splits inside a word, now or when a page adds a longer name later.
- The same rule and the same check for flowcharts and sequence diagrams.

**Non-Goals:**
- Sequence layout (`actorMargin`, `width`, `noteMargin` init lines): it sets spacing, not wrapping, and stays per diagram.
- Aligning a diagram in its frame (#328).
- Other diagram types: the site has none.

## Decisions

### D1. Sequence wrapping off, site-wide and per diagram

`mermaid.initialize` gets `sequence: { wrap: false }`, and the three `"wrap": true` init keys go. A sequence text then breaks only at its `<br/>`. `false` is Mermaid's default; setting it next to the flowchart setting states the site's rule in one place and keeps it if a Mermaid upgrade changes the default.

Alternatives considered:
- **Keep wrapping and widen `sequence.width` until the names fit.** Rejected: `breakString` cuts any word wider than the width, so the next longer name breaks again, and a wider width widens every participant box of every diagram. The same reasoning made #308 turn flowchart wrapping off (#308 design, D1).
- **Keep wrapping and write names with non-breaking characters.** Rejected: `breakString` cuts by measured width, not at break opportunities, so no character stops it.

### D2. `pnpm check` rejects sequence wrapping, read from the parsed diagram

The `mermaid blocks` test fails on a sequence diagram where any participant, message, note, block label or box has wrapping on, naming the page and the block's line. It reads the `wrap` flag Mermaid's sequence database stores on each of them, so every way to turn wrapping on is caught (init line with `sequence.wrap` or top-level `wrap`, `%%{wrap}%%`, `wrap:` prefix), not only the init key a source search would find.

Alternative: search the source for `wrap`, as #308 does for `wrappingWidth`. Rejected: it misses the `wrap:` prefix and would also match the word in a label.

### D3. The 40-character line limit covers sequence diagrams

With wrapping off a long message widens the gap between two lifelines and a long name widens its box, as a long flowchart label widens its node. The `mermaid blocks` test applies the same limit (40 characters per line, split at `<br/>`, entities counted as one) to participant names, messages, notes, block labels and box names, with the same message as for flowcharts. The 17 longer lines are broken at word boundaries.

Alternatives considered:
- **No limit for sequence diagrams.** Rejected: the three diagrams that wrapped before would carry 43-58-character lines and grow by hundreds of pixels; width would again be left to review by eye.
- **A separate, wider limit for messages.** Rejected: two numbers for one concern; 40 characters fit every token on the site and the component already shrinks wide diagrams.

The requirement "Flowchart label lines stay short" becomes "Diagram label lines stay short".

### D4. Break the formerly wrapped diagrams by hand until they fit the column again

With wrapping off, the three diagrams that wrapped grew from a 754 px viewBox to 960-1080 px at 40-character lines, so at 1280 px they no longer fit the content column at the component's 60% minimum scale and scrolled inside their frame (by 1 to 33 px). Lines between neighbouring lifelines and on self-messages are broken further at word boundaries, until each diagram fits (viewBox 912-951 px, no frame overflow at 1280 px). The participant `integration-<br/>reviewer` becomes `integration<br/>reviewer`: the role in two words, as `reviewers<br/>and judge` in the next diagram, instead of a name cut at its hyphen.

Alternatives considered:
- **A tighter line limit for sequence diagrams.** Rejected: width comes from the lines between neighbouring lifelines, not from every line; a tighter limit would rewrap lines that span the whole diagram for no gain.
- **Leave the in-frame scroll.** Rejected: the diagrams fitted before this Change; a fix for broken names should not make them scroll.
- **`integration-reviewer` on one line.** Rejected: measured, the wider box alone pushes the `/bdk:review-round` diagram past the column.

## Risks / Trade-offs

- [The three formerly wrapped diagrams get wider.] -> The lines are kept at 40 characters; the component shrinks a diagram to the column down to 60% and scrolls it sideways below that. The audit checks no page scrolls sideways as a whole.
- [#328 changes `mermaid-diagram.ts` in parallel.] -> This Change touches only the `mermaid.initialize` options; the branch merges `origin/staging/v3` before the PR.

## Migration Plan

Docs-only; the next site deploy draws the diagrams with the new setting. Rollback is a revert of the PR.

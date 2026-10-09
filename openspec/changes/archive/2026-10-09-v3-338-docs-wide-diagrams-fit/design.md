## Context

`docs/.vitepress/theme/mermaid-diagram.ts` draws every `mermaid` block with one `mermaid.initialize` and gives the SVG a `min-width` of 0.6 of its viewBox width, so a diagram shrinks to the content column down to 0.6 and then scrolls sideways inside its frame. Since #308 and #332 wrapping is off for flowcharts and sequence diagrams and `mermaid-parse.test.ts` keeps label lines at 40 characters or less.

Measured on the dev site before this Change (Chromium, light theme; dark draws the same sizes): the content column leaves 574 px inside a diagram frame at 1280 px and 292 px at 390 px. 30 of 51 diagrams have a natural width over 717 px (574 / 0.8), so they render below 0.8 and show labels under 11.2 px; 13 scroll at 1280 px. The causes are layout, not content:

- Left-to-right chains: "Stages and units of work" (2134 x 63), the three "Approach" chains (1224 to 2205 px), "Change artifacts", `findings.md`.
- The run-status decision in `run-state.md`: dagre centres each question over its two answers, so the spine moves one column right per question (1076 px, the last node cut off).
- Fans: six edges into `findings.jsonl` (run-state) and five (architecture "Findings and triage"), ten edges out of the orchestrator in "Who starts whom", whose two review leads braid their edges into three shared worker nodes.
- Sequence diagrams: Mermaid places adjacent lifelines at least `width` (150) + `actorMargin` (50) apart and adds `diagramMarginX` (50) on each side, so five participants take about 1000 px before any message. A message widens a gap only between adjacent lifelines (and a self-message by half its width on each side, a note over one lifeline likewise): `getMaxMessageWidthPerActor` in Mermaid 12.1 ignores messages that pass a lifeline.

## Goals / Non-Goals

**Goals:**
- At 1280 px every diagram renders at 0.8 of its natural width or more and no frame scrolls sideways; at 390 px no diagram is a left-to-right chain wider than two screens.
- "Who starts whom" shows each lead's workers without crossing edges.
- A check fails a pull request that adds a diagram too wide for the column, naming it.

**Non-Goals:**
- Lifelines drawn through message labels (#339) and diagram content after #317/#322 (#340).
- Centring narrow diagrams (#328).
- Larger type: labels stay 14 px.

## Decisions

### D1. One tighter sequence layout for the whole site

`mermaid.initialize` sets `sequence: { width: 96, actorMargin: 10, noteMargin: 8, diagramMarginX: 8 }` next to `wrap: false`, and the four per-diagram init lines (`actorMargin` 12 or 16, `width` 96 or 100, `noteMargin` 6) go. A box still grows to fit its name and a gap to fit its widest adjacent message; the defaults only set the minimum. The frame has its own padding, so 8 px side margins lose nothing. This alone takes 80 to 300 px off each sequence diagram.

Alternatives considered:
- **Keep per-diagram init lines.** Rejected: four diagrams already carried three different layouts, the rest Mermaid's wide defaults; every new diagram would pick again.
- **Smaller text.** Rejected: the problem is text below 11 px; a smaller font is the same defect.

### D2. Redraw by the cause, keep the content

Each diagram over 717 px is redrawn by what makes it wide; no wording changes except added `<br/>` breaks:
- A long chain or fan goes `TB`; groups of three parallel boxes sit in transparent `direction LR` subgraphs stacked by invisible links (`A ~~~ B ~~~ C`) where a single column would be very tall.
- The run-status decision keeps its questions on one straight vertical spine (`yes` downwards) and its exits in a second column, held straight by an invisible chain `S1 ~~~ S2 ~~~ ... ~~~ S6`.
- Several writers of one log become one node that lists each writer with its operation, with one `append` edge, so no arrowheads stack on one point. In the architecture design, where the three writers share one operation, they sit in a dashed subgraph with one edge.
- "Who starts whom": the orchestrator's single agents become one node; the three leads sit in one `leads` subgraph, each in its own row with the workers it starts (the same worker names repeat per lead instead of edges crossing to shared nodes).
- Sequence diagrams: participants are ordered so a long message passes a lifeline instead of widening a gap (`/bdk:close` hands off to the verifier, which writes files further right), notes span the diagram (`Note over A,Z`) instead of hanging over the last lifeline, and long adjacent messages break at `<br/>`. Where a `bdk CLI` participant only receives calls (architecture "Review round"), the calls become self-messages of the caller; six participants did not fit even at the minimum box width.

Alternative considered: **split every wide diagram in two.** Rejected where a redraw fits: two diagrams of one flow make the reader join them; the layout changes above fit every diagram without splitting one.

### D3. A browser check on the built site, in the `docs` job

`docs/.vitepress/diagram-fit.ts` serves the built site (`vitepress serve`), opens every page with a `mermaid` block in Chromium (Playwright 1.63.0) at 1280 x 900, waits until every block is drawn, and fails when a diagram's rendered width is below 0.8 of its viewBox width or its frame's `scrollWidth` exceeds its `clientWidth`. It names the page, the block's line, the scale, and the widest natural width that fits. The `docs` job of `pr.yml` runs it after `docs:build`; the job already runs on every change under `docs/`.

The spec states the rule (the "To resolve in the spec" item of #338): at 1280 px a diagram renders at 0.8 or more (labels at 11.2 px or more) and its frame does not scroll. The 0.8 floor is enforced by the check, not by `minScale`, which stays 0.6 for phones (D6).

Alternatives considered:
- **A static rule in the mermaid blocks test** (for example `flowchart LR` with more than four nodes in a chain, or more than four sequence participants). Rejected as the enforcement: width comes from measured text, so such a rule misses a three-node chain with long labels and rejects a five-participant sequence that fits; the measured layout is the only true answer, and Mermaid lays out only in a browser (happy-dom draws an empty SVG).
- **The browser check inside `pnpm check`.** Rejected: it needs the built site and a Chromium download; `pnpm check` stays offline and fast, and the `docs` job already builds the site.
- **Only by eye in review.** Rejected: that is how 30 diagrams got wide.

### D4. A diagram does not set its own configuration

`pnpm check` fails when a `mermaid` block sets an `init` or `initialize` directive or a `config:` frontmatter, naming the page and the block's line. Layout and wrapping are one site-wide decision (D1, #308, #332); a per-diagram value would make a diagram fit differently from the rest and drift from what the fit check was tuned on. It replaces the `wrappingWidth` rule, which is one case of it; the `wrap: true` checks of #332 stay, since a `wrap:` text prefix and `%%{wrap}%%` are not configuration directives.

### D5. The `mermaid-drawer` craft skill stays as it is

Its "`LR` for pipelines" and node budget are for diagrams in user projects, which render in many widths (GitHub, IDEs). The column limit is this site's, so it lives in the site's spec and check. Every redrawn diagram stays within the skill's 15-node budget.

### D6. `minScale` stays 0.6

On a phone (292 px inside the frame) a diagram up to 717 px renders at 0.6 or more and scrolls by at most 138 px, under half a screen; no diagram is a long left-to-right chain any more. A higher floor would make phones scroll more; a lower one would put 14 px labels under 8.4 px.

## Risks / Trade-offs

- [Fonts measure slightly differently on the CI runner than on macOS.] -> The site self-hosts its fonts and Mermaid measures with them, so widths match closely; every redrawn diagram stays at 700 px or less, leaving a margin below 717.
- [Taller diagrams.] -> Top-down chains are taller; the page scrolls vertically, which a reader expects, instead of a frame scrolling sideways.
- [Chromium in the `docs` job adds about a minute.] -> Only when `docs/` changes.
- [#339 changes the same sequence diagrams in parallel.] -> This Change only moves participants and breaks lines; the branch merges `origin/staging/v3` before the PR.

## Migration Plan

None: the site rebuilds from the sources.

## Open Questions

None.

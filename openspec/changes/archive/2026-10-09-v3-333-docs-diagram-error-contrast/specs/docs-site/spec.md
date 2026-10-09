## MODIFIED Requirements

### Requirement: Mermaid diagrams render as diagrams
A fenced code block with the language `mermaid` in a site page SHALL render as a diagram, in both the light and the dark theme, and SHALL re-render when the reader switches the theme. A flowchart label, and a participant name, message, note, block label or box name of a sequence diagram, SHALL break into lines only where its author wrote a line break (`<br/>`), never inside a word, whatever its length. No element of a drawn diagram SHALL draw a shadow or a glow, whatever the node's shape, in either theme. A drawn diagram narrower than the inside of its frame SHALL sit centred horizontally in the frame; a diagram wider than the inside of its frame SHALL start at the frame's left padding and scroll sideways, so its left edge stays reachable. No lifeline, message line or frame line (a `loop`, `alt`, `opt` or `par` border or section divider) of a drawn sequence diagram SHALL be visible through the letters of a message, a frame condition or a section title: the line passes behind the text, in either theme and at any width. When a block does not parse, and before a block is drawn, the site SHALL show the block's source as code in the colour of the site's other code blocks, with a contrast of at least 4.5:1 against its background in either theme.

#### Scenario: Diagram in a design document
- **WHEN** a reader opens the v3 architecture design page on the site
- **THEN** each of its `mermaid` blocks shows as an SVG diagram, not as code

#### Scenario: Theme switch
- **WHEN** a reader switches the site from the light to the dark theme on a page with a diagram
- **THEN** the diagram is drawn again with the dark theme

#### Scenario: Hyphenated name in a flowchart label
- **WHEN** a reader opens `docs/concepts/orchestrators.md` on the site, in the light or the dark theme, at desktop or phone width
- **THEN** a node label such as `Agent bdk:implementer<br/>/bdk:implement-part` shows `/bdk:implement-part` on one line, and no flowchart label on the page is split inside a word

#### Scenario: Hyphenated name in a sequence diagram
- **WHEN** a reader opens `docs/concepts/orchestrators.md` on the site, in the light or the dark theme, at desktop or phone width
- **THEN** the participant `/bdk:pr-review` and the message `Agent: /bdk:pr-review-round` each show the name on one line, and no text of a sequence diagram on the page is split inside a word

#### Scenario: Stadium node draws flat
- **WHEN** a reader opens `docs/concepts/findings.md` on the site, in the light or the dark theme
- **THEN** the stadium node "decided" draws flat like the box nodes next to it, with no shadow and no glow around it

#### Scenario: Narrow diagram sits centred
- **WHEN** a reader opens `docs/guide/index.md` or `docs/concepts/orchestrators.md` on the site at 1280 px, in the light or the dark theme
- **THEN** the flowchart of the Guide page and each diagram of the orchestrators page narrower than its frame has equal space to its left and to its right inside the frame

#### Scenario: Wide diagram scrolls at phone width
- **WHEN** a reader opens `docs/concepts/orchestrators.md` on the site at 390 px
- **THEN** a diagram wider than its frame starts at the frame's left padding and scrolls sideways, and scrolling back reaches its left edge

#### Scenario: Lifeline behind a message label
- **WHEN** a reader opens `docs/concepts/run-state.md` on the site, in the light or the dark theme, at desktop or phone width
- **THEN** in the Execute diagram the message `read C/plan/parts, state.json`, which spans the implementer and conformer lifelines, and the frame condition `[merge conflict]`, which a lifeline runs under, read without a line through their letters, and the lines continue on both sides of the text

#### Scenario: Source of a diagram that does not parse
- **WHEN** a reader opens a site page whose `mermaid` block has a syntax error, in the light or the dark theme, at desktop or phone width
- **THEN** the page shows the error and the block's source, and the source text has a contrast of at least 4.5:1 against the code block background, in the same colour as the text of the site's other code blocks

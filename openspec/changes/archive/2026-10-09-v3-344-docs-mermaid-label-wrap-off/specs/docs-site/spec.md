## ADDED Requirements

### Requirement: Drawn labels keep their author's lines
The `docs` job of PR CI SHALL fail when, at a viewport width of 1280 px on the built site, a drawn flowchart node, edge or subgraph label shows a different number of lines than its source has `<br/>`-separated lines, when a drawn line of a sequence block label (`alt`, `else`, `opt`, `loop`, `par`, `and`, `critical`, `option`, `break`) is not a line of its source label, or when a block label line runs past the frame of its block or, on the frame's top row, past its label tab. It SHALL name the page, the block's line and the label.

#### Scenario: Edge label wrapped by Mermaid
- **WHEN** a pull request makes Mermaid draw the edge label `archived, openspec/ uncommitted` of `docs/concepts/orchestrators.md` on two lines
- **THEN** the `docs` job fails and names the page, the block's line and the label, with the lines it shows and the lines its source has

#### Scenario: Block label wider than its block
- **WHEN** a pull request adds `par batches of execution.max-parallel` over two neighbouring lifelines to a sequence diagram of a Concepts page
- **THEN** the `docs` job fails, names the page, the block's line and the label `[batches of execution.max-parallel]`, and says to break it with `<br/>`

#### Scenario: Block label line past its block
- **WHEN** a pull request adds a block label with a `<br/>` whose first line is wider than its block
- **THEN** the `docs` job fails and names the page, the block's line, the label line and how far it runs past the block

## MODIFIED Requirements

### Requirement: Mermaid diagrams render as diagrams
A fenced code block with the language `mermaid` in a site page SHALL render as a diagram, in both the light and the dark theme, and SHALL re-render when the reader switches the theme. A flowchart node, edge or subgraph label, and a participant name, message, note, block label or box name of a sequence diagram, SHALL break into lines only where its author wrote a line break (`<br/>`), never inside a word, whatever its length. No element of a drawn diagram SHALL draw a shadow or a glow, whatever the node's shape, in either theme. A drawn diagram narrower than the inside of its frame SHALL sit centred horizontally in the frame; a diagram wider than the inside of its frame SHALL start at the frame's left padding and scroll sideways, so its left edge stays reachable. No lifeline, message line or frame line (a `loop`, `alt`, `opt` or `par` border or section divider) of a drawn sequence diagram SHALL be visible through the letters of a message, a frame condition or a section title: the line passes behind the text, in either theme and at any width. When a block does not parse, and before a block is drawn, the site SHALL show the block's source as code in the colour of the site's other code blocks, with a contrast of at least 4.5:1 against its background in either theme.

#### Scenario: Diagram in a design document
- **WHEN** a reader opens the v3 architecture design page on the site
- **THEN** each of its `mermaid` blocks shows as an SVG diagram, not as code

#### Scenario: Theme switch
- **WHEN** a reader switches the site from the light to the dark theme on a page with a diagram
- **THEN** the diagram is drawn again with the dark theme

#### Scenario: Hyphenated name in a flowchart label
- **WHEN** a reader opens `docs/concepts/orchestrators.md` on the site, in the light or the dark theme, at desktop or phone width
- **THEN** a node label such as `Agent bdk:implementer<br/>/bdk:implement-part` shows `/bdk:implement-part` on one line, and no flowchart label on the page is split inside a word

#### Scenario: Long edge label
- **WHEN** a reader opens `docs/concepts/orchestrators.md` or the v3 architecture design page on the site, in the light or the dark theme, at desktop or phone width
- **THEN** the edge labels `archived, openspec/ uncommitted` (`/bdk:close`) and `Agent bdk:lead + stage skill, background` (D1 B) each show on one line

#### Scenario: Hyphenated name in a sequence diagram
- **WHEN** a reader opens `docs/concepts/orchestrators.md` on the site, in the light or the dark theme, at desktop or phone width
- **THEN** the participant `/bdk:pr-review` and the message `Agent: /bdk:pr-review-round` each show the name on one line, and no text of a sequence diagram on the page is split inside a word

#### Scenario: Block label as written
- **WHEN** a reader opens `docs/concepts/orchestrators.md` or the v3 architecture design page on the site, in the light or the dark theme, at desktop or phone width
- **THEN** every block label shows the lines its source has, such as `[batches of` / `execution.max-parallel]` and `[policy.gates.design` / `= manual]`, each inside its block

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

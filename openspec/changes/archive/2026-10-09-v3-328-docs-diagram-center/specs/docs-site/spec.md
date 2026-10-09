## MODIFIED Requirements

### Requirement: Mermaid diagrams render as diagrams
A fenced code block with the language `mermaid` in a site page SHALL render as a diagram, in both the light and the dark theme, and SHALL re-render when the reader switches the theme. A flowchart label SHALL break into lines only where its author wrote a line break (`<br/>`), never inside a word, whatever the label's length. No element of a drawn diagram SHALL draw a shadow or a glow, whatever the node's shape, in either theme. A drawn diagram narrower than the inside of its frame SHALL sit centred horizontally in the frame; a diagram wider than the inside of its frame SHALL start at the frame's left padding and scroll sideways, so its left edge stays reachable.

#### Scenario: Diagram in a design document
- **WHEN** a reader opens the v3 architecture design page on the site
- **THEN** each of its `mermaid` blocks shows as an SVG diagram, not as code

#### Scenario: Theme switch
- **WHEN** a reader switches the site from the light to the dark theme on a page with a diagram
- **THEN** the diagram is drawn again with the dark theme

#### Scenario: Hyphenated name in a flowchart label
- **WHEN** a reader opens `docs/concepts/orchestrators.md` on the site, in the light or the dark theme, at desktop or phone width
- **THEN** a node label such as `Agent bdk:implementer<br/>/bdk:implement-part` shows `/bdk:implement-part` on one line, and no flowchart label on the page is split inside a word

#### Scenario: Stadium node draws flat
- **WHEN** a reader opens `docs/concepts/findings.md` on the site, in the light or the dark theme
- **THEN** the stadium node "decided" draws flat like the box nodes next to it, with no shadow and no glow around it

#### Scenario: Narrow diagram sits centred
- **WHEN** a reader opens `docs/guide/index.md` or `docs/concepts/orchestrators.md` on the site at 1280 px, in the light or the dark theme
- **THEN** the flowchart of the Guide page and each diagram of the orchestrators page narrower than its frame has equal space to its left and to its right inside the frame

#### Scenario: Wide diagram scrolls at phone width
- **WHEN** a reader opens `docs/concepts/orchestrators.md` on the site at 390 px
- **THEN** a diagram wider than its frame starts at the frame's left padding and scrolls sideways, and scrolling back reaches its left edge

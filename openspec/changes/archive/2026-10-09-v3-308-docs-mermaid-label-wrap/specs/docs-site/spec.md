## MODIFIED Requirements

### Requirement: Mermaid diagrams render as diagrams
A fenced code block with the language `mermaid` in a site page SHALL render as a diagram, in both the light and the dark theme, and SHALL re-render when the reader switches the theme. A flowchart label SHALL break into lines only where its author wrote a line break (`<br/>`), never inside a word, whatever the label's length.

#### Scenario: Diagram in a design document
- **WHEN** a reader opens the v3 architecture design page on the site
- **THEN** each of its `mermaid` blocks shows as an SVG diagram, not as code

#### Scenario: Theme switch
- **WHEN** a reader switches the site from the light to the dark theme on a page with a diagram
- **THEN** the diagram is drawn again with the dark theme

#### Scenario: Hyphenated name in a flowchart label
- **WHEN** a reader opens `docs/concepts/orchestrators.md` on the site, in the light or the dark theme, at desktop or phone width
- **THEN** a node label such as `Agent bdk:implementer<br/>/bdk:implement-part` shows `/bdk:implement-part` on one line, and no flowchart label on the page is split inside a word

## ADDED Requirements

### Requirement: Flowchart label lines stay short
`pnpm check` SHALL fail when a flowchart in a site page has a label line (node, edge or subgraph label, split at `<br/>`, HTML entities counted as one character) longer than 40 characters, and SHALL name the page, the block's line and the label line. It SHALL also fail when a `mermaid` block in a site page sets `wrappingWidth` itself, and SHALL name the page and the block's line.

#### Scenario: Long label line
- **WHEN** a pull request adds a flowchart node `A["writes R/debug/reproduction.md and R/debug/diagnosis.md"]` to a Concepts page
- **THEN** `pnpm check` fails and names the page, the block's line and the label line

#### Scenario: Per-diagram wrapping width
- **WHEN** a pull request adds `%%{init: {"flowchart": {"wrappingWidth": 200}}}%%` to a `mermaid` block of a Concepts page
- **THEN** `pnpm check` fails and names the page and the block's line

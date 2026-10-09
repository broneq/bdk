## MODIFIED Requirements

### Requirement: Mermaid diagrams render as diagrams
A fenced code block with the language `mermaid` in a site page SHALL render as a diagram, in both the light and the dark theme, and SHALL re-render when the reader switches the theme. A flowchart label, and a participant name, message, note, block label or box name of a sequence diagram, SHALL break into lines only where its author wrote a line break (`<br/>`), never inside a word, whatever its length. No element of a drawn diagram SHALL draw a shadow or a glow, whatever the node's shape, in either theme.

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

### Requirement: Diagram label lines stay short
`pnpm check` SHALL fail when a diagram in a site page has a label line longer than 40 characters, and SHALL name the page, the block's line and the label line. A label line is a line, split at `<br/>` with HTML entities counted as one character, of a flowchart node, edge or subgraph label, or of a sequence diagram participant name, message, note, block label or box name. It SHALL also fail when a `mermaid` block in a site page sets `wrappingWidth` itself, or when a sequence diagram turns wrapping on for any of its texts, and SHALL name the page and the block's line.

#### Scenario: Long label line
- **WHEN** a pull request adds a flowchart node `A["writes R/debug/reproduction.md and R/debug/diagnosis.md"]` to a Concepts page
- **THEN** `pnpm check` fails and names the page, the block's line and the label line

#### Scenario: Long sequence message
- **WHEN** a pull request adds the message `L->>B: bdk check run round-N --at review --changed base --round N` to a sequence diagram of a Concepts page
- **THEN** `pnpm check` fails and names the page, the block's line and the message line

#### Scenario: Per-diagram wrapping width
- **WHEN** a pull request adds `%%{init: {"flowchart": {"wrappingWidth": 200}}}%%` to a `mermaid` block of a Concepts page
- **THEN** `pnpm check` fails and names the page and the block's line

#### Scenario: Sequence wrapping turned on
- **WHEN** a pull request adds `%%{init: {"sequence": {"wrap": true}}}%%` to a sequence diagram of a Concepts page, or starts one of its messages with `wrap:`
- **THEN** `pnpm check` fails and names the page and the block's line

## RENAMED Requirements

- FROM: `### Requirement: Flowchart label lines stay short`
- TO: `### Requirement: Diagram label lines stay short`

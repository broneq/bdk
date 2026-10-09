## ADDED Requirements

### Requirement: Diagrams fit the content column
At a viewport width of 1280 px, every Mermaid diagram of a site page SHALL render at a scale of at least 0.8 of its natural width, so its 14 px labels show at 11.2 px or more, and its frame SHALL NOT scroll sideways. At a viewport width of 390 px no diagram SHALL be a left-to-right chain wider than two screens. The `docs` job of PR CI SHALL fail when a diagram of the built site renders below that scale or its frame scrolls sideways at 1280 px, and SHALL name the page, the block's line, the rendered scale and the widest natural width that fits.

#### Scenario: Long left-to-right chain
- **WHEN** a pull request adds a `flowchart LR` chain of nine stages to a Concepts page, 1800 px wide
- **THEN** the `docs` job fails and names the page, the block's line, the scale it renders at and that at most 717 px fits

#### Scenario: Wide sequence diagram
- **WHEN** a pull request adds a sequence diagram whose messages between neighbouring lifelines make it 960 px wide
- **THEN** the `docs` job fails and names the page and the block's line

#### Scenario: Diagrams on the site today
- **WHEN** a reader opens any page of the site with a diagram at 1280 px, in the light or the dark theme
- **THEN** every diagram renders at 0.8 of its natural width or more and no diagram frame scrolls sideways

#### Scenario: Who starts whom
- **WHEN** a reader opens the "Who starts whom" diagram of `docs/concepts/agents.md`
- **THEN** each lead shows in its own row with the workers it starts, and no edge crosses another

#### Scenario: Phone width
- **WHEN** a reader opens a page with a diagram at 390 px
- **THEN** no diagram is a left-to-right chain, and a diagram that scrolls sideways scrolls by less than one screen

## MODIFIED Requirements

### Requirement: Diagram label lines stay short
`pnpm check` SHALL fail when a diagram in a site page has a label line longer than 40 characters, and SHALL name the page, the block's line and the label line. A label line is a line, split at `<br/>` with HTML entities counted as one character, of a flowchart node, edge or subgraph label, or of a sequence diagram participant name, message, note, block label or box name. It SHALL also fail when a `mermaid` block in a site page sets its own Mermaid configuration (an `init` or `initialize` directive, or a `config:` frontmatter), or when a sequence diagram turns wrapping on for any of its texts, and SHALL name the page and the block's line.

#### Scenario: Long label line
- **WHEN** a pull request adds a flowchart node `A["writes R/debug/reproduction.md and R/debug/diagnosis.md"]` to a Concepts page
- **THEN** `pnpm check` fails and names the page, the block's line and the label line

#### Scenario: Long sequence message
- **WHEN** a pull request adds the message `L->>B: bdk check run round-N --at review --changed base --round N` to a sequence diagram of a Concepts page
- **THEN** `pnpm check` fails and names the page, the block's line and the message line

#### Scenario: Per-diagram wrapping width
- **WHEN** a pull request adds `%%{init: {"flowchart": {"wrappingWidth": 200}}}%%` to a `mermaid` block of a Concepts page
- **THEN** `pnpm check` fails and names the page and the block's line

#### Scenario: Per-diagram layout
- **WHEN** a pull request adds `%%{init: {"sequence": {"actorMargin": 50}}}%%`, or a `config:` frontmatter, to a `mermaid` block of a Concepts page
- **THEN** `pnpm check` fails and names the page and the block's line

#### Scenario: Sequence wrapping turned on
- **WHEN** a pull request adds `%%{init: {"sequence": {"wrap": true}}}%%` to a sequence diagram of a Concepts page, or starts one of its messages with `wrap:`
- **THEN** `pnpm check` fails and names the page and the block's line

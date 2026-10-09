## MODIFIED Requirements

### Requirement: Diagrams fit the content column
At a viewport width of 1280 px, every Mermaid diagram of a site page SHALL render at a scale of at least 0.8 of its natural width, so its 14 px labels show at 11.2 px or more, and its frame SHALL NOT scroll sideways. At a viewport width of 390 px no diagram SHALL be a left-to-right chain wider than two screens. The `docs` job of PR CI SHALL fail when a diagram of the built site renders below that scale or its frame scrolls sideways at 1280 px, and SHALL name the page, the block's line, the rendered scale and the widest natural width that fits. The check SHALL measure each diagram only once Mermaid has laid it out; a diagram it cannot measure (not drawn, or drawn with no natural width) or that shows a Mermaid error SHALL fail the check, named by its page and the block's line, never pass it.

#### Scenario: Long left-to-right chain
- **WHEN** a pull request adds a `flowchart LR` chain of nine stages to a Concepts page, 1800 px wide
- **THEN** the `docs` job fails and names the page, the block's line, the scale it renders at and that at most 717 px fits

#### Scenario: Wide sequence diagram
- **WHEN** a pull request adds a sequence diagram whose messages between neighbouring lifelines make it 960 px wide
- **THEN** the `docs` job fails and names the page and the block's line

#### Scenario: Too wide as the last diagram of a page
- **WHEN** the last diagram of a page with several diagrams is redrawn 750 px wide
- **THEN** the `docs` job fails and names that page, that block's line and its scale below 0.8

#### Scenario: Diagram the check cannot measure
- **WHEN** a diagram of the built site is not laid out when the check measures it, or its drawn SVG has no natural width
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

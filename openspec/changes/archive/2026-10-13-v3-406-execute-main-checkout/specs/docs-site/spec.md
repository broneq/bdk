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
- **THEN** in the Execute diagram the message `read C/plan/parts, state.json`, which spans the implementer and conformer lifelines, and the frame condition `[red wave check]`, which a lifeline runs under, read without a line through their letters, and the lines continue on both sides of the text

#### Scenario: Source of a diagram that does not parse
- **WHEN** a reader opens a site page whose `mermaid` block has a syntax error, in the light or the dark theme, at desktop or phone width
- **THEN** the page shows the error and the block's source, and the source text has a contrast of at least 4.5:1 against the code block background, in the same colour as the text of the site's other code blocks

### Requirement: The Reference lists the problems of bdk plan check
The `bdk` CLI Reference page SHALL list, under the entry of `bdk plan check`, every problem kind the command can report, in the order the command lists them, each with what it means and what to do. The text SHALL be read by the generator from the plan checks of the `bdk` plugin, where each problem kind is declared next to its text, so a problem kind without its text fails `pnpm check`.

#### Scenario: Every problem kind has an entry
- **WHEN** the generator renders the `bdk` CLI Reference page
- **THEN** the page holds one row under `bdk plan check` for each problem kind the command reports, from `no-parts` to `cycle`, each with what it means and what to do

#### Scenario: Problem kind added without its text
- **WHEN** a contributor adds a problem kind to `bdk plan check` without its text
- **THEN** `pnpm check` fails

### Requirement: The Concepts explain how a plan is cut
The Concepts SHALL explain how a plan is cut: what a part, `depends-on` and a wave mean, how waves follow from `depends-on`, that the parts run one at a time in the main checkout in plan order, that the plan aims at the fewest waves because the wave check runs once per wave, and what to look at when reviewing a part file. The section SHALL link to the problem list of `bdk plan check` in the Reference, and the plan stage of the Guide's workflow page SHALL link to it.

#### Scenario: Reviewing a plan
- **WHEN** a reader of the plan stage in `docs/guide/workflow.md` follows its link about parts and waves
- **THEN** they reach the section of `docs/concepts/stages.md` that explains parts, waves and `depends-on`, and links to the problems of `bdk plan check` in the Reference

### Requirement: The Concepts show where execute runs the checks

The Concepts page of the orchestrators SHALL show, in the execute diagrams, every run of `bdk check run` in the execute stage: the red acceptance tests and the part checks of `/bdk:implement-part`, the checks of `/bdk:conform-part`, and the wave check of the execute lead with its repair by `/bdk:repair-wave`. Its text SHALL say which files a check on changed files covers, which check point each run uses, and that the checks of the `review` point run only in `/bdk:auto-review`. The execute stage of the Concepts and of the Guide SHALL link to it.

#### Scenario: Where the tests of a part run

- **WHEN** a reader of the execute stage in `docs/guide/workflow.md` follows its link about the checks
- **THEN** they reach the part of `docs/concepts/orchestrators.md` that names each check run of the execute stage, who runs it, at which point, on which files, and what happens when it is red

#### Scenario: What execute does not check

- **WHEN** a reader looks for what runs the checks on a wave committed on the Change branch
- **THEN** the page says that the execute lead runs the checks of the `wave` point on the files changed since the wave's base, repairs a red wave with `/bdk:repair-wave`, and leaves the `review` point to `/bdk:auto-review`

### Requirement: Concepts diagrams match the sources
Every Mermaid diagram of a Concepts page SHALL show what the BDK skills, agents, hooks and `bdk` commands of the plugin sources do: no step, exit, command, settings key, file or agent the sources hold for the flow it draws is missing, none it draws is gone, and no diagram contradicts the prose or the table next to it. Each orchestrator and each block a user types that starts its own agent SHALL have a section in `docs/concepts/orchestrators.md` with its diagram, and its skill SHALL be listed in that page's Sources.

#### Scenario: Slice graph
- **WHEN** a reader opens the slice graph of "The `bdk` CLI" in `docs/concepts/cli-config-hooks.md`
- **THEN** it shows one node for each slice of `plugins/bdk/src/slices.ts`, `diagnostics` included, and one edge for each import it lists

#### Scenario: Parts in sequence in the execute diagrams
- **WHEN** a reader opens the execute diagrams of `docs/concepts/orchestrators.md` and the Execute sequence of `docs/concepts/run-state.md`
- **THEN** they show the parts run one at a time in the main checkout, each committed before the next, and no worktree, part branch, merge or `/bdk:resolve-conflict`

#### Scenario: Waves in the execute diagrams
- **WHEN** a reader opens the Execute sequence and the run-status decision of `docs/concepts/run-state.md`
- **THEN** the sequence shows the lead's `bdk check run wave-N`, the repair by `/bdk:repair-wave` writing `execute/wave-N.md` and the lead committing it, and the decision keeps the stage at execute while a wave is not done or blocked

#### Scenario: A run diagnosed after the fact
- **WHEN** a reader looks in `docs/concepts/orchestrators.md` for what `/bdk:diagnose-run` runs
- **THEN** a section draws its steps: `bdk:analyst` started by its step 0, `bdk diagnostics report`, the run files read, each waste lead judged against its transcript lines, and `R/diagnostics.md` written

#### Scenario: Keys per stage
- **WHEN** a reader compares the keys-per-stage diagram of `docs/concepts/cli-config-hooks.md` with the key table under it
- **THEN** every key the table names for a stage's orchestrator or its blocks shows in that stage's box


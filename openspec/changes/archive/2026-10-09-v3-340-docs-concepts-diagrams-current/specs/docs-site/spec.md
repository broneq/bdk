## ADDED Requirements

### Requirement: Concepts diagrams match the sources
Every Mermaid diagram of a Concepts page SHALL show what the BDK skills, agents, hooks and `bdk` commands of the plugin sources do: no step, exit, command, settings key, file or agent the sources hold for the flow it draws is missing, none it draws is gone, and no diagram contradicts the prose or the table next to it. Each orchestrator and each block a user types that starts its own agent SHALL have a section in `docs/concepts/orchestrators.md` with its diagram, and its skill SHALL be listed in that page's Sources.

#### Scenario: Slice graph
- **WHEN** a reader opens the slice graph of "The `bdk` CLI" in `docs/concepts/cli-config-hooks.md`
- **THEN** it shows one node for each slice of `plugins/bdk/src/slices.ts`, `diagnostics` included, and one edge for each import it lists

#### Scenario: Waves in the execute diagrams
- **WHEN** a reader opens the Execute sequence and the run-status decision of `docs/concepts/run-state.md`
- **THEN** the sequence shows the lead's `bdk check run wave-N`, the repair by `/bdk:resolve-conflict --wave` writing `execute/wave-N.md` and the lead committing it, and the decision keeps the stage at execute while a wave is not done or blocked

#### Scenario: A run diagnosed after the fact
- **WHEN** a reader looks in `docs/concepts/orchestrators.md` for what `/bdk:diagnose-run` runs
- **THEN** a section draws its steps: `bdk:analyst` started by its step 0, `bdk diagnostics report`, the run files read, each waste lead judged against its transcript lines, and `R/diagnostics.md` written

#### Scenario: Keys per stage
- **WHEN** a reader compares the keys-per-stage diagram of `docs/concepts/cli-config-hooks.md` with the key table under it
- **THEN** every key the table names for a stage's orchestrator or its blocks shows in that stage's box

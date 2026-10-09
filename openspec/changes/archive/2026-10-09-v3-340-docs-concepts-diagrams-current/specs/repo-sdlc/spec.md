## MODIFIED Requirements

### Requirement: Behaviour-changing Changes update the docs
The SDLC in `CLAUDE.md` SHALL require that a Change which changes what a BDK user sees (a skill, agent, hook, `bdk` command, settings key, or the flow between them) updates the hand-written pages of the site (`docs/guide/`, `docs/concepts/`) and regenerates the Reference in the same pull request. The update SHALL cover the Mermaid diagrams of those pages as well as their prose and tables: a Change that adds, removes or reorders a step, an exit, a command, a settings key, a file or an agent of a flow SHALL update every diagram that draws that flow. The `tasks` rules in `openspec/config.yaml` SHALL require such a Change to hold a docs task of its own that names the pages it updates and the diagrams on them it redraws, or to state in its proposal's Impact why no page changes. The `apply` and `archive` guidance in `openspec/config.yaml` SHALL name the docs task, so that an unchecked docs task shows in `/opsx:verify` as an incomplete task and blocks the archive.

#### Scenario: Instructions carry the docs rule
- **WHEN** a contributor runs `openspec instructions tasks --change <name> --json`
- **THEN** the rules in the output require a docs task for a behaviour-changing Change

#### Scenario: Docs task left open
- **WHEN** a Change's docs task is unchecked and a contributor runs `/opsx:verify`
- **THEN** the report lists the docs task as incomplete

#### Scenario: A step added to a flow
- **WHEN** a contributor runs `openspec instructions tasks --change <name> --json` for a Change that adds a step to a skill
- **THEN** the rules in the output require its docs task to name the diagrams that draw the skill's flow, and the SDLC "Docs" rule in `CLAUDE.md` says the same

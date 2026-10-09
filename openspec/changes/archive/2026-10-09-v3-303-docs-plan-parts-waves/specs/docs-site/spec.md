## ADDED Requirements

### Requirement: The Reference lists the problems of bdk plan check
The `bdk` CLI Reference page SHALL list, under the entry of `bdk plan check`, every problem kind the command can report, in the order the command lists them, each with what it means and what to do. The text SHALL be read by the generator from the plan checks of the `bdk` plugin, where each problem kind is declared next to its text, so a problem kind without its text fails `pnpm check`.

#### Scenario: Every problem kind has an entry
- **WHEN** the generator renders the `bdk` CLI Reference page
- **THEN** the page holds one row under `bdk plan check` for each problem kind the command reports, from `no-parts` to `shared-not-alone`, each with what it means and what to do

#### Scenario: Problem kind added without its text
- **WHEN** a contributor adds a problem kind to `bdk plan check` without its text
- **THEN** `pnpm check` fails

### Requirement: The Concepts explain how a plan is cut
The Concepts SHALL explain how a plan is cut: what a part, `depends-on`, a wave and `isolation` (`worktree`, `shared`) mean, how waves follow from `depends-on`, that the plan aims at the fewest waves, and what to look at when reviewing a part file. The section SHALL link to the problem list of `bdk plan check` in the Reference, and the plan stage of the Guide's workflow page SHALL link to it.

#### Scenario: Reviewing a plan
- **WHEN** a reader of the plan stage in `docs/guide/workflow.md` follows its link about parts and waves
- **THEN** they reach the section of `docs/concepts/stages.md` that explains parts, waves, `depends-on` and `isolation`, and links to the problems of `bdk plan check` in the Reference

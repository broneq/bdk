## MODIFIED Requirements

### Requirement: Explorer agent

The plugin SHALL ship the agent `bdk:explorer` (`plugins/bdk/agents/explorer.md`) on the model `sonnet`, with only the tools to search and read code, to run its block's skill, and to write its run file. It SHALL change no file of the project.

#### Scenario: Agent definition

- **WHEN** `plugins/bdk/agents/explorer.md` is read
- **THEN** its frontmatter names `explorer`, model `sonnet`, and tools that include `Read`, `Grep`, `Glob`, `Write` and `Skill` and exclude `Edit`

### Requirement: Explore writes a code map

`explore` SHALL read the Change's `proposal.md` and the code it touches, and SHALL write `.bdk/runs/<change>/design/explore.md` with these sections: `## Touches` (the modules, entry points, data types and boundaries the proposal touches), `## Patterns` (conventions the change must follow), `## Tests` (where and how the touched code is tested), `## Gaps` (what the proposal needs that the code lacks) and `## Unsure` (what it could not settle). Every claim about the code SHALL name a file and line. `explore` SHALL follow the project's test command to the script it runs and the test runner's setup files, and SHALL read the project's rules for the commands the Change runs (`CLAUDE.md` or `AGENTS.md`, the hooks of `.claude/settings.json` and the scripts they call, the docs on how to build, test or run the project); a hook, wrapper or setup step that changes how such a command runs SHALL be named under `## Patterns` or `## Gaps` with its `file:line`. A question about the options or output of a command-line tool the proposal relies on SHALL be settled by running the tool's read-only help or version command (`<tool> --help`, `<tool> <subcommand> --help`, `<tool> --version`) and naming that command as the evidence; that command SHALL run as a Bash command of its own from the project root, with the tool's path as the project writes it (no `cd`, no absolute path, nothing chained); only when that command cannot run SHALL the point go to `## Unsure`, naming the command that would settle it. The reply to the caller SHALL be the path of the file and at most three lines. Continued with a question, the agent SHALL answer it from the code and append the answer to `explore.md` as a `## Follow-up <n>` section.

#### Scenario: Map of a Change

- **WHEN** `explore` runs for a Change whose proposal adds a CSV export of ledger entries
- **THEN** `.bdk/runs/<change>/design/explore.md` exists, holds the five sections, and names the ledger module with a `file:line` reference

#### Scenario: Options of a CLI settled

- **WHEN** the proposal uploads the export with the project's `bin/upload` CLI and does not say which flag names the target folder, and `bin/upload --help` lists `--folder <name>`
- **THEN** a command running `bin/upload --help` ran, `explore.md` names `--folder`, and its `## Unsure` does not hold the upload flag

#### Scenario: How the tests run

- **WHEN** the project's `npm test` runs a budget wrapper that starts `node --test` with a global setup file starting a server, and a hook in `.claude/settings.json` blocks a direct `node --test` call
- **THEN** `explore.md` names the wrapper, the global setup file and the hook, each with a `file:line` reference

#### Scenario: Follow-up question

- **WHEN** the caller continues the explorer with a question about where amounts are formatted
- **THEN** `explore.md` gains a `## Follow-up 1` section answering it with `file:line` references, and the earlier sections are unchanged

### Requirement: Eval cases of the design blocks

`plugins/bdk/evals/` SHALL hold, tagged `block` and built on a shared fixture of a configured project with an OpenSpec Change, at least one case for `explore`, one for `explore` settling a CLI's options with its help command, one for `explore` naming the project's test wrapper, test setup and test hook (`explore-project-facts`), one for `verify-design` with a false claim about the code, one for `verify-design` on a second pass, six for `design-draft`: the Lavish path, the path without Lavish, `policy.questions: decide-and-record`, a project rule of stage `design` the design must follow and cite (`design-draft-rules`), a follow-up round opened by a note, and an answer that drops a capability of the proposal, and one for `verify-design` on a design that breaks a project rule of stage `design` (`verify-design-rules`). Run with and without the plugin, each block SHALL score higher with it than without it, and the results SHALL be recorded in the Change.

#### Scenario: Effect over no plugin

- **WHEN** `pnpm --filter @bdk/bdk run eval` runs the cases `explore-*`, `design-draft-*` and `verify-design-*` with and without the plugin
- **THEN** each block's mean `WITH` score is above its `W/OUT` score

#### Scenario: Design rule cases

- **WHEN** `pnpm --filter @bdk/bdk run eval` runs `design-draft-rules` and `verify-design-rules` with the plugin
- **THEN** `design-draft-rules` grades that `design.md` follows the rule and names its id, and `verify-design-rules` grades that the report fails and names the rule's id

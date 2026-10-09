## MODIFIED Requirements

### Requirement: Local run

`pnpm --filter @bdk/bdk run eval` SHALL build the plugin and run its suite with the Claude Code version pinned in the root `devDependencies`, running case scaffolds, and SHALL pass further arguments to `claude plugin eval`. The run SHALL inherit the caller's `PATH` without any `node_modules/.bin` directory, so a command a case calls by name, such as `openspec`, resolves to an install outside the workspace and not to a pnpm shim whose package the run's sandbox cannot read. Before the run starts, the command SHALL print a warning naming `openspec` when that `PATH` holds no `openspec`, or holds one whose real path lies under the home directory, and SHALL start the run either way. `plugins/bdk/evals/README.md` SHALL say how to run the suite, how to probe cheaply, how to grant tools, how to write a block case, an orchestrator case and a shared fixture, which global OpenSpec the cases that call `openspec` need, and the host limits a case author meets.

#### Scenario: Arguments pass through

- **WHEN** a contributor runs `pnpm --filter @bdk/bdk run eval --case 'sample-*' --runs 1`
- **THEN** only `sample-handover-note` runs, once per arm

#### Scenario: No workspace bin directory reaches the run

- **WHEN** a contributor runs `pnpm --filter @bdk/bdk run eval` and pnpm has put `plugins/bdk/node_modules/.bin` and `node_modules/.bin` first on `PATH`
- **THEN** the `PATH` that `claude plugin eval` and its runs inherit holds neither directory, and keeps every other entry in its order

#### Scenario: OpenSpec cases reach OpenSpec

- **WHEN** a contributor with a global OpenSpec 1.13.2 outside the home directory runs `propose-from-issue` with the README's command from a checkout under the home directory
- **THEN** the run calls `openspec new change` successfully and scores as it does when the workspace OpenSpec is not installed

#### Scenario: No readable OpenSpec is warned about

- **WHEN** the `PATH` left after removing the `node_modules/.bin` directories holds no `openspec`, or one whose real path lies under the home directory
- **THEN** the command prints a warning naming `openspec` and the README section to read, and the run still starts

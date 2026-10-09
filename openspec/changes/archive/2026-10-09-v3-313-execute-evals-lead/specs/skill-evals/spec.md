## MODIFIED Requirements

### Requirement: Local run

`pnpm --filter @bdk/bdk run eval` SHALL build the plugin and run its suite with the Claude Code version pinned in the root `devDependencies`, running case scaffolds, and SHALL pass further arguments to `claude plugin eval`. The run SHALL inherit the caller's `PATH` without any `node_modules/.bin` directory, so a command a case calls by name, such as `openspec`, resolves to an install outside the workspace and not to a pnpm shim whose package the run's sandbox cannot read. When `CLAUDE_CODE_SHELL_PREFIX` names an absolute path, the directory of that file SHALL come first on the `PATH` the run inherits, so the run's sandbox, which reads under `/Users` only the directories on `PATH`, can run the prefix. Before the run starts, the command SHALL print a warning naming `openspec` when that `PATH` holds no `openspec`, or holds one whose real path lies under the home directory, and SHALL start the run either way. `plugins/bdk/evals/README.md` SHALL say how to run the suite, how to probe cheaply, how to grant tools, how to write a block case, an orchestrator case and a shared fixture, which global OpenSpec the cases that call `openspec` need, and the host limits a case author meets.

#### Scenario: Arguments pass through

- **WHEN** a contributor runs `pnpm --filter @bdk/bdk run eval --case 'sample-*' --runs 1`
- **THEN** only `sample-handover-note` runs, once per arm

#### Scenario: No workspace bin directory reaches the run

- **WHEN** a contributor runs `pnpm --filter @bdk/bdk run eval` and pnpm has put `plugins/bdk/node_modules/.bin` and `node_modules/.bin` first on `PATH`
- **THEN** the `PATH` that `claude plugin eval` and its runs inherit holds neither directory, and keeps every other entry in its order

#### Scenario: The shell prefix is readable in a run

- **WHEN** a contributor on a Mac without Homebrew git runs the README's `execute-*` command with `CLAUDE_CODE_SHELL_PREFIX` set to the prefix the "Host limits" `git` entry installs
- **THEN** the prefix's directory is the first entry of the run's `PATH`, the skill's `bdk config show` block runs, and `/bdk:execute` starts its `bdk:lead` agent

#### Scenario: OpenSpec cases reach OpenSpec

- **WHEN** a contributor with a global OpenSpec 1.13.2 outside the home directory runs `propose-from-issue` with the README's command from a checkout under the home directory
- **THEN** the run calls `openspec new change` successfully and scores as it does when the workspace OpenSpec is not installed

#### Scenario: No readable OpenSpec is warned about

- **WHEN** the `PATH` left after removing the `node_modules/.bin` directories holds no `openspec`, or one whose real path lies under the home directory
- **THEN** the command prints a warning naming `openspec` and the README section to read, and the run still starts

## ADDED Requirements

### Requirement: Execute cases run end to end

The `execute-*` orchestrator cases SHALL each start the `bdk:lead` agent and its workers when run with the command `plugins/bdk/evals/README.md` gives for them. That command SHALL grant `SendMessage` and `ToolSearch`, which `/bdk:execute` uses to continue its lead after a blocker and to load `AskUserQuestion`, besides the tools and Bash commands the lead and its workers call. The README SHALL record the score of every `execute-*` case from such a run, with its date and Claude Code version.

#### Scenario: The README command grants what the stage uses

- **WHEN** a contributor reads the README command of the `execute-*` cases
- **THEN** it grants `Write`, `Edit`, `SendMessage`, `ToolSearch` and the Bash commands `*/bin/bdk *`, `mkdir -p *`, `cd *` and `git *`

#### Scenario: Every execute case starts the lead

- **WHEN** a contributor runs every `execute-*` case once with the README command (and, on a Mac without Homebrew git, the `git` entry of "Host limits")
- **THEN** in each run `/bdk:execute` starts one `bdk:lead` agent that writes `.bdk/runs/add-totals/execute/result.md`, and `execute-single-part-wave`, `execute-resume-worktree` and `execute-resume-main-checkout` score 1.00

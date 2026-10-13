## MODIFIED Requirements

### Requirement: Execute cases run end to end

The `execute-*` orchestrator cases SHALL each start the `bdk:lead` agent and its workers when run with the command `plugins/bdk/evals/README.md` gives for them. That command SHALL grant `SendMessage` and `ToolSearch`, which `/bdk:execute` uses to continue its lead after a blocker and to load `AskUserQuestion`, besides the tools and Bash commands the lead and its workers call. The README SHALL record the score of every `execute-*` case from such a run, with its date and Claude Code version.

#### Scenario: The README command grants what the stage uses

- **WHEN** a contributor reads the README command of the `execute-*` cases
- **THEN** it grants `Write`, `Edit`, `SendMessage`, `ToolSearch` and the Bash commands `*/bin/bdk *`, `mkdir -p *` and `git *`

#### Scenario: Every execute case starts the lead

- **WHEN** a contributor runs every `execute-*` case once with the README command (and, on a Mac without Homebrew git, the `git` entry of "Host limits")
- **THEN** in each run `/bdk:execute` starts one `bdk:lead` agent that writes `.bdk/runs/add-totals/execute/result.md`, and `execute-main-checkout` and `execute-resume-main-checkout` score 1.00


## ADDED Requirements

### Requirement: Eval case of execute in the main checkout

The suite SHALL hold the orchestrator case `execute-main-checkout` on the fixture `ledger-totals-three-parts.sh` (the Change `add-totals` with the waves `1: 01 02` and `2: 03`, none built). It SHALL grade that `/bdk:execute` starts one `bdk:lead`; that an implementer runs for each of the parts `01`, `02` and `03`, in that order, with no `--workdir` in any worker prompt; that no Bash call of the run holds `git worktree` or `git merge`; that the reflog of the branch `add-totals` holds one commit per part in the order `01`, `02`, `03` and no merge; that `state.json` marks every part `done`; and that `execute/result.md` starts with `Status: done`.

#### Scenario: Multi-part plan built in the main checkout

- **WHEN** `execute-main-checkout` runs with the README command of the `execute-*` cases
- **THEN** its graders pass: three implementers in part order, no `--workdir`, no `git worktree` or `git merge` call, three commits on `add-totals` in part order with no merge, every part `done`, and `Status: done`

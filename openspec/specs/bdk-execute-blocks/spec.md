# bdk-execute-blocks Specification

## Purpose

Defines the execute blocks of the `bdk` plugin: `implement-part`, which builds one plan part of a Change test-first on the agent `bdk:implementer`, and `conform-part`, which checks and fixes that part's diff on the agent `bdk:conformer`, and the report files both leave for the execute lead.

## Requirements

### Requirement: Blocks and agents

The `bdk` plugin SHALL ship the skills `implement-part` (`skills/implement-part/`) and `conform-part` (`skills/conform-part/`) and the agents `bdk:implementer` (`agents/implementer.md`) and `bdk:conformer` (`agents/conformer.md`), each agent with the default model `sonnet` and the tools `Read`, `Edit`, `Write`, `Bash`, `Grep`, `Glob` and `Skill`, and without `Agent`. A caller SHALL start an agent with the `Agent` tool and a prompt naming its skill and arguments; the agent SHALL run that skill with the `Skill` tool. When either skill runs anywhere but on its agent, it SHALL start its agent with the same arguments, wait for it, and reply with the agent's first report line and the report path, doing none of the work itself. `bdk:implementer` runs `implement-part`; `bdk:conformer` runs `conform-part`.

Each block SHALL get the configuration from its own `bdk config show` block; in a project that is not configured, or whose configuration is invalid, it SHALL stop with the line that command prints, start no agent and write no file.

#### Scenario: Started by a user

- **WHEN** a user asks in the main conversation to implement part `01` of Change `add-csv-export`
- **THEN** the skill `implement-part` starts `bdk:implementer` with the arguments `add-csv-export 01`, and the main conversation edits no file itself

#### Scenario: Not configured

- **WHEN** `conform-part` runs in a project without `.bdk/settings.yaml`
- **THEN** it starts no agent, writes no file, and its reply says `BDK not configured: run /bdk:setup`

### Requirement: Input and run directory

Both blocks SHALL take `<change> <part-id> [--run-dir <path>]`. The part is `openspec/changes/<change>/plan/parts/<part-id>.md`; the run directory is `--run-dir`, else `.bdk/runs/<change>/`. A caller working in another worktree SHALL pass the absolute run directory of the main checkout, so the reports land where the execute lead reads them, while the blocks read and edit the files of the working directory. Without a Change name a block SHALL use the only Change under `openspec/changes/` other than `archive/`; without a part id, or when the part file is missing, it SHALL name what it found and stop.

#### Scenario: Reports in another checkout

- **WHEN** the execute lead runs part `02` in a worktree with `--run-dir /work/app/.bdk/runs/add-csv-export`
- **THEN** the part's code changes are in the worktree and `execute/part-02.md` and `checks/02.json` are under `/work/app/.bdk/runs/add-csv-export/`

### Requirement: Limits on what a block changes

Both blocks SHALL edit only paths listed in the part's `files`, plus their own files under the run directory. They SHALL NOT change git history or the index (no commit, stash, reset, checkout or restore of paths, rebase, merge, add), SHALL NOT install packages, and SHALL NOT run a command that reaches the network, spends money or needs credentials. They SHALL run the project's checks only through `bdk check run`. When the work needs anything outside these limits, `implement-part` SHALL stop with a blocker and `conform-part` SHALL leave the item.

#### Scenario: File outside the part

- **WHEN** a task of part `02` can only be done by changing `src/ledger.js`, which is not in the part's `files`
- **THEN** `implement-part` does not edit `src/ledger.js` and reports `Status: blocker` with `Kind: plan-defect` naming the file

### Requirement: Check the part before the code

Before it edits any file, `implement-part` SHALL read the part, every acceptance scenario it names in the Change's spec deltas, the Change's `design.md`, the rules `bdk rules for --stage execute` selects for the part's files, and the project instructions (`CLAUDE.md` and `AGENTS.md` in the project root and in the directories of the part's files, and `.claude/rules/` files whose `paths` match them). It SHALL check each task contract (spec `bdk-plan-blocks`, D1 format) against them and against the code: the named interface exists or is to be created as written, the change fits the part's `files`, and the task agrees with its acceptance scenarios. A contract that is wrong, missing, contradicts a scenario or needs a file outside `files` SHALL be a plan defect: the block SHALL stop without editing, and SHALL NOT pick a side or work around it. A gap the contract leaves open and the specs and code settle SHALL be decided and recorded under `Decisions taken without the user`.

#### Scenario: Task contradicts its scenario

- **WHEN** a task says amounts are written as integer cents while its acceptance scenario "Amount in cents" expects `-1200.00` for `-120000`
- **THEN** `implement-part` writes no product or test file and reports `Status: blocker`, `Kind: plan-defect`, the task and the scenario as evidence, and a proposal for the plan fix

### Requirement: Acceptance tests first

`implement-part` SHALL write, before the code of the tasks, at least one test per acceptance scenario of the part that encodes the scenario's WHEN and THEN, in the project's test conventions, inside the part's `files`. It SHALL run those tests with `bdk check run <run-dir> <part-id>-red --kind test --scope <test files>` and see them fail because the behaviour is missing, not because the test is broken. Then it SHALL implement the tasks in their order, following the rules and project instructions it read.

#### Scenario: Red then green

- **WHEN** `implement-part` builds part `01` of `add-csv-export` with four acceptance scenarios
- **THEN** its report lists four scenarios under `Acceptance tests`, each with its test, `red seen` and `green seen`, and `checks/01-red.json` holds a red test check

### Requirement: Part checks

After the code, `implement-part` SHALL run `bdk check run <run-dir> <part-id> --scope <each file of the part>` and, on a `fail` verdict, fix what the failing check's output shows and run it again, at most three runs in all. `Status: done` SHALL require a `pass` verdict, or `none` when the project configures no check, which the report states. A verdict still `fail` after the third run SHALL be a blocker of kind `other` with the failing check's tail as evidence; a check that cannot run (a missing tool, `tools.test` not configured so no red can be seen) SHALL be a blocker of kind `environment`.

#### Scenario: Checks stay red

- **WHEN** the part's test check still fails after three runs
- **THEN** the report has `Status: blocker`, `Kind: other`, and the failing check's output path as evidence

### Requirement: Implementer report

`implement-part` SHALL write `<run-dir>/execute/part-<part-id>.md`, replacing an earlier one, in the body of D7: the first line `Status: done` or `Status: blocker`; then `## Acceptance tests` (one line per acceptance scenario: the scenario, the test, `red seen`, `green seen`), `## Changed files` (every path it created, changed or deleted), `## Checks` (`checks/<id>.json: <verdict>` per check run), `## Blocker` only with `Status: blocker` (`Kind: plan-defect | environment | other`, `Evidence:`, `Proposal:`), and `## Decisions taken without the user`. An empty section SHALL hold `- None.` The block SHALL reply with the status line and the report path only.

When it is started again for a part whose files already hold work (a retry), it SHALL read the earlier report and continue from the files as they are.

#### Scenario: Part done

- **WHEN** `implement-part` finishes part `01` with green checks
- **THEN** `execute/part-01.md` starts with `Status: done`, lists `checks/01.json: pass` under `Checks`, has no `## Blocker` section, and the reply is that line and the path

### Requirement: Conform the part's diff

`conform-part` SHALL require `<run-dir>/execute/part-<part-id>.md` starting with `Status: done`; otherwise it SHALL write a `Verdict: FAIL` report naming the missing or blocked implementer report and change nothing. It SHALL take the part's diff from the working tree against `HEAD`, tracked changes and untracked files, limited to the part's `files`, and check every changed line against the rules `bdk rules for --stage execute` selects for the changed files, the project instructions (as for `implement-part`), and each task of the part: file, interface as written, and its `Verified by` test present.

It SHALL fix each violation whose fix keeps behaviour unchanged - every input gives the same output, every test that passed still passes - inside the part's `files`, and SHALL leave every violation whose fix would change behaviour, add a feature or a test of a new behaviour, or touch another file. It SHALL NOT fix bugs.

#### Scenario: Rule and instruction violations fixed

- **WHEN** the diff of part `01` holds a comment narrating the change (rule `BDK-CQ-4`), an import of `assert/strict` where `CLAUDE.md` asks for `node:` imports, and an exported `formatCents` that task 2 declares private
- **THEN** `conform-part` removes the comment, changes the import to `node:assert/strict` and makes `formatCents` private, lists each under `Fixed` with its rule, instruction file or task, and the part checks still pass

#### Scenario: Missing behaviour left, not fixed

- **WHEN** task 1 of part `01` asks to double inner double quotes in descriptions and the code wraps such a description without doubling them
- **THEN** `conform-part` does not add the doubling, lists it under `Left` naming task 1 and the line, and the verdict is `FAIL`

### Requirement: Conformer report

After its fixes, changed files or not, `conform-part` SHALL run `bdk check run <run-dir> conform-<part-id> --scope <each file of the part>`. It SHALL write `<run-dir>/execute/conform-<part-id>.md`, replacing an earlier one, in the body of D7: the first line `Verdict: PASS` or `Verdict: FAIL`, then `## Fixed` (one line per fix: file and line, the rule id, instruction file or task, what changed), `## Left` (one line per item left: file and line, its source, what is wrong, why it was left) and `## Checks` (`checks/conform-<part-id>.json: <verdict>`). An empty section SHALL hold `- None.` The verdict SHALL be `FAIL` if and only if the check verdict is `fail`, a `Left` item names a task of the part, or the implementer report is missing or not done. A rule or instruction left SHALL NOT fail the part by itself (D2 of the skills decisions); the review reads it. The block SHALL reply with the verdict line and the report path only.

#### Scenario: Clean part passes

- **WHEN** the diff of part `01` breaks no rule, instruction or task and its checks pass
- **THEN** `execute/conform-01.md` starts with `Verdict: PASS`, `Fixed` and `Left` hold `- None.`, and no product file changed

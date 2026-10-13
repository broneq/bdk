## MODIFIED Requirements

### Requirement: Blocks and agents

The `bdk` plugin SHALL ship the skills `implement-part` (`skills/implement-part/`), `conform-part` (`skills/conform-part/`) and `repair-wave` (`skills/repair-wave/`) and the agents `bdk:implementer` (`agents/implementer.md`) and `bdk:conformer` (`agents/conformer.md`), each agent with the default model `sonnet` and the tools `Read`, `Edit`, `Write`, `Bash`, `Grep`, `Glob` and `Skill`, and without `Agent`. A caller SHALL start an agent with the `Agent` tool and a prompt naming its skill and arguments; the agent SHALL run that skill with the `Skill` tool. When any of these skills runs anywhere but on its agent, it SHALL start its agent with the same arguments, wait for it, and reply with the agent's first report line and the report path, doing none of the work itself. `bdk:implementer` runs `implement-part` and `repair-wave`; `bdk:conformer` runs `conform-part`. The plugin SHALL NOT ship a skill `resolve-conflict`.

Each block SHALL get the configuration from its own `bdk config show` block; in a project that is not configured, or whose configuration is invalid, it SHALL stop with the line that command prints, start no agent and write no file.

#### Scenario: Started by a user

- **WHEN** a user asks in the main conversation to implement part `01` of Change `add-csv-export`
- **THEN** the skill `implement-part` starts `bdk:implementer` with the arguments `add-csv-export 01`, and the main conversation edits no file itself

#### Scenario: Not configured

- **WHEN** `conform-part` runs in a project without `.bdk/settings.yaml`
- **THEN** it starts no agent, writes no file, and its reply says `BDK not configured: run /bdk:setup`

### Requirement: Part from another directory

`implement-part`, `conform-part` and `repair-wave` SHALL take `--parts <dir>`. With it, the part SHALL be `<dir>/<part-id>.md` instead of `openspec/changes/<change>/plan/parts/<part-id>.md` (for `repair-wave`, the parts of the wave are read from `<dir>`); everything else, the run directory, the reports and the checks, SHALL be as without it.

#### Scenario: Fix part

- **WHEN** `implement-part monthly-report 03 --run-dir <run> --parts <run>/review/round-1/fixes/parts` runs
- **THEN** it reads the contract of `<run>/review/round-1/fixes/parts/03.md` and writes `<run>/execute/part-03.md`

### Requirement: Repair a red wave check

`repair-wave` SHALL take `<change> <n> --base <commit> [--run-dir <path>] [--parts <dir>]`, started by the execute lead when the wave check `checks/wave-<n>.json` of wave `<n>` is red after every part of the wave is committed on the Change branch. It SHALL run in the main checkout on the Change branch. It SHALL read the red checks of `checks/wave-<n>.json` and their output files, the parts of wave `<n>` (the parts directory's parts whose wave, from `bdk plan check <parts dir>`, is `<n>`) with their tasks and acceptance scenarios, and the diff `git diff <commit>` of those parts' files, and SHALL fix the cause within the `files` of the wave's parts, keeping what each part meant. It SHALL NOT change git history or the index. It SHALL run `bdk check run <run-dir> wave-<n> --at wave --changed <commit>` after its fix and, on `fail`, fix again, at most three runs in all.

It SHALL write `<run-dir>/execute/wave-<n>.md`, replacing an earlier one: the first line `Status: done` or `Status: blocker`, then `## Repaired` (one line per change: file, which parts it reconciles, what changed), `## Checks` (`checks/wave-<n>.json: <verdict>`), `## Blocker` only with `Status: blocker` (`Kind: conflict` when two parts contradict each other so no file keeps both, `Kind: other` when checks stay red, with `Evidence:` and `Proposal:`), and `## Decisions taken without the user`. `Status: done` SHALL require a `pass` or `none` verdict of its last run. It SHALL reply with the status line and the report path only. When `checks/wave-<n>.json` is missing or its verdict is not `fail`, it SHALL change nothing, write no report, and reply that the wave check is not red.

#### Scenario: Two green parts red together

- **WHEN** part `01` added `summary()` with a test that expects `Balance: 12.5`, part `02` of the same wave then made `balance()` round to cents, its own part check (on its changed files) passed, and `checks/wave-1.json` fails on part `01`'s test
- **THEN** `repair-wave add-totals 1 --base <commit>` brings the two parts' intent together within their `files`, `checks/wave-1.json` passes, `execute/wave-1.md` starts with `Status: done`, and nothing is staged or committed

#### Scenario: Wave check not red

- **WHEN** `repair-wave add-totals 1 --base <commit>` runs and `checks/wave-1.json` has the verdict `pass`
- **THEN** it changes no file, writes no report, and its reply says that the wave check is not red

## ADDED Requirements

### Requirement: Part and run directory

`implement-part` and `conform-part` SHALL take `<change> <part-id> [--run-dir <path>]`. The part is `openspec/changes/<change>/plan/parts/<part-id>.md`; the run directory is `--run-dir`, else `.bdk/runs/<change>/`. Both SHALL read and edit the code in the working directory, the main checkout, and SHALL take no `--workdir`. Without a Change name a block SHALL use the only Change under `openspec/changes/` other than `archive/`; without a part id, or when the part file is missing, it SHALL name what it found and stop.

#### Scenario: Reports under the run directory

- **WHEN** the execute lead runs part `02` with `--run-dir /work/app/.bdk/runs/add-csv-export`
- **THEN** the part's code changes are in the working directory, and `execute/part-02.md` and `checks/02.json` are under `/work/app/.bdk/runs/add-csv-export/`

## REMOVED Requirements

### Requirement: Resolve a merge conflict

**Reason**: Parts no longer run in worktrees, so no part branch is merged and no merge can stop on a conflict; `execute-waves` was the block's only caller.

**Migration**: None for a user: the execute lead commits each part on the Change branch. A red wave check is repaired by `repair-wave`, which takes the wave repair of `resolve-conflict --wave` unchanged.

### Requirement: Input and run directory

**Reason**: `--workdir` had one caller, the execute lead running a part in a worktree, which no longer happens.

**Migration**: Replaced by "Part and run directory": the same arguments without `--workdir`.

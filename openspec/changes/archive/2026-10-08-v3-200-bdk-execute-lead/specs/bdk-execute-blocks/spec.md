## MODIFIED Requirements

### Requirement: Blocks and agents

The `bdk` plugin SHALL ship the skills `implement-part` (`skills/implement-part/`), `conform-part` (`skills/conform-part/`) and `resolve-conflict` (`skills/resolve-conflict/`) and the agents `bdk:implementer` (`agents/implementer.md`) and `bdk:conformer` (`agents/conformer.md`), each agent with the default model `sonnet` and the tools `Read`, `Edit`, `Write`, `Bash`, `Grep`, `Glob` and `Skill`, and without `Agent`. A caller SHALL start an agent with the `Agent` tool and a prompt naming its skill and arguments; the agent SHALL run that skill with the `Skill` tool. When any of these skills runs anywhere but on its agent, it SHALL start its agent with the same arguments, wait for it, and reply with the agent's first report line and the report path, doing none of the work itself. `bdk:implementer` runs `implement-part` and `resolve-conflict`; `bdk:conformer` runs `conform-part`.

Each block SHALL get the configuration from its own `bdk config show` block; in a project that is not configured, or whose configuration is invalid, it SHALL stop with the line that command prints, start no agent and write no file.

#### Scenario: Started by a user

- **WHEN** a user asks in the main conversation to implement part `01` of Change `add-csv-export`
- **THEN** the skill `implement-part` starts `bdk:implementer` with the arguments `add-csv-export 01`, and the main conversation edits no file itself

#### Scenario: Not configured

- **WHEN** `conform-part` runs in a project without `.bdk/settings.yaml`
- **THEN** it starts no agent, writes no file, and its reply says `BDK not configured: run /bdk:setup`

### Requirement: Input and run directory

`implement-part` and `conform-part` SHALL take `<change> <part-id> [--run-dir <path>] [--workdir <path>]`. The part is `openspec/changes/<change>/plan/parts/<part-id>.md`; the run directory is `--run-dir`, else `.bdk/runs/<change>/`; the work directory is `--workdir`, else the working directory. A subagent cannot change its working directory, so with `--workdir` a block SHALL read and edit only absolute paths under the work directory, SHALL run git as `git -C <workdir> <command>` and every other shell command as `cd <workdir> && <command>`, one command per call, and SHALL read the part, the spec deltas and the design from the work directory. A caller working in another worktree SHALL pass the worktree as `--workdir` and the absolute run directory of the main checkout as `--run-dir`, so the code changes stay in the worktree and the reports land where the execute lead reads them. Without a Change name a block SHALL use the only Change under `openspec/changes/` other than `archive/`; without a part id, or when the part file is missing, it SHALL name what it found and stop.

#### Scenario: Reports in another checkout

- **WHEN** the execute lead runs part `02` with `--workdir /work/app/.bdk/runs/add-csv-export/worktrees/02` and `--run-dir /work/app/.bdk/runs/add-csv-export`
- **THEN** the part's code changes are in the worktree, the main checkout's files are unchanged, and `execute/part-02.md` and `checks/02.json` are under `/work/app/.bdk/runs/add-csv-export/`

### Requirement: Implementer report

`implement-part` SHALL write `<run-dir>/execute/part-<part-id>.md`, replacing an earlier one, in the body of D7: the first line `Status: done` or `Status: blocker`; then `## Acceptance tests` (one line per acceptance scenario: the scenario, the test, `red seen`, `green seen`), `## Changed files` (every path it created, changed or deleted), `## Checks` (`checks/<id>.json: <verdict>` per check run), `## Blocker` only with `Status: blocker` (`Kind: plan-defect | environment | other`, `Evidence:`, `Proposal:`), and `## Decisions taken without the user`. An empty section SHALL hold `- None.` The block SHALL reply with the status line and the report path only.

When it is started again for a part whose files already hold work (a retry), it SHALL read the earlier report and continue from the files as they are. When `<run-dir>/execute/conform-<part-id>.md` says `Verdict: FAIL`, it SHALL treat each `Left` item naming a task as work still to do and a red conform check as a check to make green.

#### Scenario: Part done

- **WHEN** `implement-part` finishes part `01` with green checks
- **THEN** `execute/part-01.md` starts with `Status: done`, lists `checks/01.json: pass` under `Checks`, has no `## Blocker` section, and the reply is that line and the path

#### Scenario: Retry after a failed conform

- **WHEN** `implement-part` runs part `01` again and `execute/conform-01.md` says `Verdict: FAIL` with a `Left` item `src/csv.js:12 task 1: quotes not doubled`
- **THEN** it adds a test for the doubling, sees it red, makes it green, and its new report says `Status: done`

## ADDED Requirements

### Requirement: Resolve a merge conflict

`resolve-conflict` SHALL take `<change> <part-id> [--run-dir <path>]`, where `<part-id>` is the part whose branch the execute lead was merging when git stopped on conflicts. It SHALL run in the checkout holding the merge and SHALL stop, changing nothing, when no file is unmerged (`git diff --name-only --diff-filter=U` prints nothing). For each unmerged file it SHALL read both sides and what each side was for - the part `<part-id>` and every part of the Change whose `files` list that file, with their tasks and acceptance scenarios - and SHALL edit the file so it holds what both sides meant, without conflict markers. It SHALL edit only the unmerged files. It SHALL NOT stage, commit, abort or continue the merge, and SHALL NOT change git history or the index; the lead does. It SHALL run `bdk check run <run-dir> merge-<part-id> --scope <path>...` with every unmerged file and every file of the parts it read, and on `fail` fix what the output shows within the unmerged files, at most three runs in all.

It SHALL write `<run-dir>/execute/merge-<part-id>.md`: the first line `Status: done` or `Status: blocker`, then `## Resolved files` (one line per file: what each side added and how the result keeps both), `## Checks` (`checks/merge-<part-id>.json: <verdict>`), `## Blocker` only with `Status: blocker` (`Kind: conflict | other`, `Evidence:`, `Proposal:`), and `## Decisions taken without the user`. When the two sides contradict each other, so that no file keeps both (the same function returning different values for the same input), it SHALL leave that file as it is and report `Kind: conflict`. `Status: done` SHALL require no conflict marker in any resolved file and a `pass` or `none` check verdict. It SHALL reply with the status line and the report path only.

#### Scenario: Two functions added at the same place

- **WHEN** part `01` added `income(entries)` and part `02` added `expenses(entries)` at the end of `src/ledger.js`, and merging part `02` stopped on a conflict in that file
- **THEN** `src/ledger.js` holds both functions and no conflict marker, the merge is still in progress with nothing staged, `checks/merge-02.json` passes, and `execute/merge-02.md` starts with `Status: done`

#### Scenario: Nothing to resolve

- **WHEN** `resolve-conflict` runs in a checkout with no unmerged file
- **THEN** it changes no file, writes no report, and its reply says that no merge conflict was found

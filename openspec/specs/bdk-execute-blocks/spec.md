# bdk-execute-blocks Specification

## Purpose

Defines the execute blocks of the `bdk` plugin: `implement-part`, which builds one plan part of a Change test-first on the agent `bdk:implementer`, and `conform-part`, which checks and fixes that part's diff on the agent `bdk:conformer`, and the report files both leave for the execute lead.

## Requirements

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

### Requirement: Limits on what a block changes

Both blocks SHALL edit only paths listed in the part's `files`, plus their own files under the run directory. They SHALL NOT change git history or the index (no commit, stash, reset, checkout or restore of paths, rebase, merge, add), SHALL NOT install packages, and SHALL NOT run a command that reaches the network, spends money or needs credentials. They SHALL run the project's checks only through `bdk check run`; the one other command they MAY run is `openspec validate <change> --strict`, on a part that changes a spec delta. When the work needs anything outside these limits, `implement-part` SHALL stop with a blocker and `conform-part` SHALL leave the item.

#### Scenario: File outside the part

- **WHEN** a task of part `02` can only be done by changing `src/ledger.js`, which is not in the part's `files`
- **THEN** `implement-part` does not edit `src/ledger.js` and reports `Status: blocker` with `Kind: plan-defect` naming the file

### Requirement: Check the part before the code

Before it edits any file, `implement-part` SHALL read the part, every acceptance scenario it names in the Change's spec deltas, the Change's `design.md`, the rules `bdk rules for --stage execute` selects for the part's files, and the project instructions (`CLAUDE.md` and `AGENTS.md` in the project root and in the directories of the part's files, and `.claude/rules/` files whose `paths` match them). It SHALL check each task contract (spec `bdk-plan-blocks`, D1 format) against them and against the code: the named interface exists or is to be created as written, the change fits the part's `files`, and the task agrees with its acceptance scenarios. A contract that is wrong, missing, contradicts a scenario or needs a file outside `files` SHALL be a plan defect: the block SHALL stop without editing, and SHALL NOT pick a side or work around it. A gap the contract leaves open and the specs and code settle SHALL be decided and recorded under `Decisions taken without the user`.

#### Scenario: Task contradicts its scenario

- **WHEN** a task says amounts are written as integer cents while its acceptance scenario "Amount in cents" expects `-1200.00` for `-120000`
- **THEN** `implement-part` writes no product or test file and reports `Status: blocker`, `Kind: plan-defect`, the task and the scenario as evidence, and a proposal for the plan fix

### Requirement: Acceptance tests first

`implement-part` SHALL write, before the code of the tasks, at least one test per acceptance scenario of the part that encodes the scenario's WHEN and THEN, in the project's test conventions, inside the part's `files`. It SHALL run those tests with `bdk check run <run-dir> <part-id>-red --at part --kind test --scope <test files>` and see them fail because the behaviour is missing, not because the test is broken. It SHALL count a test as seen red only when it saw that test's own failure: when the tail the command prints does not show every acceptance test failing, it SHALL read the red check's output file. A verdict `none` (no `tools.test` item runs at `part` on these files) SHALL be a blocker of kind `environment` naming `/bdk:setup`. Then it SHALL implement the tasks in their order, following the rules and project instructions it read.

An acceptance scenario the part lists with the suffix ` (behaviour present)` guards behaviour the code already has: its test SHALL pass in the red run, and `implement-part` SHALL count it as green at its first run only when it saw that test's own pass. A disagreement between the part and the code SHALL be a blocker of kind `plan-defect`, never `other`: the test of an unmarked scenario passes in the red run while it encodes the WHEN and THEN (proposal: mark the scenario ` (behaviour present)`), or the test of a marked scenario fails because the behaviour is missing (proposal: drop the marker and add a task that fixes the code).

#### Scenario: Red then green

- **WHEN** `implement-part` builds part `01` of `add-csv-export` with four acceptance scenarios
- **THEN** its report lists four scenarios under `Acceptance tests`, each line ending `; red seen; green seen`, and `checks/01-red.json` holds a red test check and `at` `part`

#### Scenario: Whole-suite item left out of the red run

- **WHEN** the configuration has the `tools.test` items `vitest-related` (`command: pnpm vitest related --run {files}`, `when: [part]`) and `unit` (`command: pnpm test`, `when: [wave, review]`), and `implement-part` runs its red run
- **THEN** `checks/<part-id>-red.json` holds one check, `test vitest-related`, and `pnpm test` does not run

#### Scenario: A failure above the tail

- **WHEN** two acceptance tests fail in the red run and the 20-line tail printed under the red check shows only the second test's failure
- **THEN** `implement-part` reads the output file and finds the first test's failure there before it writes any code, and its report line for the first test ends `; red seen; green seen` with no note

#### Scenario: Test of present behaviour

- **WHEN** fix part `02` of `add-total` lists `tally / Requirement: Total / Scenario: Empty ledger (behaviour present)` and its only task adds a test for it, and `tally total` already prints `Total: 0.00` in an empty directory
- **THEN** the red run passes, `implement-part` writes no code, the part check passes, and `execute/part-02.md` starts with `Status: done` and its line for the scenario ends `; green at first run (behaviour present); green seen`

#### Scenario: Unmarked scenario already green

- **WHEN** the same part lists the scenario without ` (behaviour present)` and its test passes in the red run
- **THEN** `execute/part-02.md` starts with `Status: blocker`, its `## Blocker` has `Kind: plan-defect` naming the scenario, and its proposal is to mark the scenario ` (behaviour present)`

### Requirement: Part checks

After the code, `implement-part` SHALL run `bdk check run <run-dir> <part-id> --at part --changed HEAD`, so the items of the `part` point run on the files the part changed, and, on a `fail` verdict, fix what the failing check's output shows and run it again, at most three runs in all. `Status: done` SHALL require a `pass` verdict, or `none` when no item runs at `part` on these files, which the report states. A verdict still `fail` after the third run SHALL be a blocker of kind `other` with the failing check's tail as evidence; a check that cannot run (a missing tool, no `tools.test` item at `part` so no red can be seen) SHALL be a blocker of kind `environment`.

#### Scenario: Checks stay red

- **WHEN** the part's test check still fails after three runs
- **THEN** the report has `Status: blocker`, `Kind: other`, and the failing check's output path as evidence

#### Scenario: Only the part point runs

- **WHEN** the configuration has the `tools.lint` items `eslint-changed` (`command: pnpm eslint {files}`, `when: [part]`) and `tsc` (`command: pnpm tsc --noEmit`, `when: [wave, review]`), and part `02` changed `src/a.ts`
- **THEN** `checks/02.json` holds `lint eslint-changed` with the command `pnpm eslint src/a.ts`, and `tsc` did not run

### Requirement: Validate a changed spec delta

When a part's diff changes a file under `openspec/changes/<change>/specs/`, `implement-part` SHALL run `openspec validate <change> --strict` after its part checks, fix each error on a delta in the part's `files` and run it again, at most three runs in all; an error still there after the third run SHALL be a blocker of kind `other` with the error as evidence, and `Status: done` SHALL require that no error names a delta of the part. `conform-part` SHALL run the same command on such a part, whatever the implementer report says, and list each error on a delta of the part under `Left` naming the task that changed that delta, so the verdict is `FAIL`; it SHALL NOT add or change spec text to fix it. An error on a file outside the part's `files` SHALL NOT fail the part: the implementer notes it under `Decisions taken without the user`, the conformer under `Left` as `outside the part`. Both reports SHALL name the run under `## Checks` as `openspec validate <change> --strict: pass` or `: fail`, or `openspec validate: not run, no OpenSpec CLI` when no `openspec` command is found, which SHALL NOT fail the part. A part that changes no spec delta SHALL NOT run it.

#### Scenario: Requirement without a scenario left by the implementer

- **WHEN** part `01` of `add-total` added the requirement `Bad amount` to `openspec/changes/add-total/specs/tally/spec.md` without a `#### Scenario:`, and its implementer report says `Status: done`
- **THEN** `conform-part` runs `openspec validate add-total --strict`, leaves the delta unchanged, lists a `Left` item naming task 1, and its report starts with `Verdict: FAIL`

#### Scenario: Implementer fixes its own invalid delta

- **WHEN** `implement-part` builds a task that adds a requirement to a delta of its part and `openspec validate <change> --strict` reports that the requirement has no scenario
- **THEN** it adds the scenario the task names, runs the validation again, and its report lists `openspec validate <change> --strict: pass` under `## Checks`

#### Scenario: Part without a delta

- **WHEN** part `02` changes only `src/csv.js` and its test
- **THEN** neither block runs `openspec validate`

### Requirement: Implementer report

`implement-part` SHALL write `<run-dir>/execute/part-<part-id>.md`, replacing an earlier one, in the body of D7: the first line `Status: done` or `Status: blocker`; then `## Acceptance tests` (one line per acceptance scenario: the scenario, the test, and the line ending exactly `; red seen; green seen`, or `; green at first run (behaviour present); green seen` for a scenario the part marks ` (behaviour present)`, with nothing between or after; a remark about a test goes under `Decisions taken without the user`), `## Changed files` (every path it created, changed or deleted), `## Checks` (`checks/<id>.json: <verdict>` per check run), `## Blocker` only with `Status: blocker` (`Kind: plan-defect | environment | other`, `Evidence:`, `Proposal:`), and `## Decisions taken without the user`. An empty section SHALL hold `- None.` The block SHALL reply with the status line and the report path only.

When it is started again for a part whose files already hold work (a retry), it SHALL read the earlier report and continue from the files as they are. When `<run-dir>/execute/conform-<part-id>.md` says `Verdict: FAIL`, it SHALL treat each `Left` item naming a task as work still to do and a red conform check as a check to make green.

#### Scenario: Part done

- **WHEN** `implement-part` finishes part `01` with green checks
- **THEN** `execute/part-01.md` starts with `Status: done`, lists `checks/01.json: pass` under `Checks`, has no `## Blocker` section, and the reply is that line and the path

#### Scenario: Retry after a failed conform

- **WHEN** `implement-part` runs part `01` again and `execute/conform-01.md` says `Verdict: FAIL` with a `Left` item `src/csv.js:12 task 1: quotes not doubled`
- **THEN** it adds a test for the doubling, sees it red, makes it green, and its new report says `Status: done`

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

After its fixes, `conform-part` SHALL run `bdk check run <run-dir> conform-<part-id> --at part --changed HEAD` when it edited at least one file. When it edited none, it SHALL run no check and its `## Checks` section SHALL name the implementer's last part check (`checks/<part-id>.json: pass, unchanged`). It SHALL write `<run-dir>/execute/conform-<part-id>.md`, replacing an earlier one, in the body of D7: the first line `Verdict: PASS` or `Verdict: FAIL`, then `## Fixed` (one line per fix: file and line, the rule id, instruction file or task, what changed), `## Left` (one line per item left: file and line, its source, what is wrong, why it was left) and `## Checks` (`checks/conform-<part-id>.json: <verdict>`, or the unchanged implementer check). An empty section SHALL hold `- None.` The verdict SHALL be `FAIL` if and only if the check verdict is `fail`, a `Left` item names a task of the part, or the implementer report is missing or not done. A rule or instruction left SHALL NOT fail the part by itself (D2 of the skills decisions); the review reads it. The block SHALL reply with the verdict line and the report path only.

#### Scenario: Clean part passes

- **WHEN** the diff of part `01` breaks no rule, instruction or task and its checks pass
- **THEN** `execute/conform-01.md` starts with `Verdict: PASS`, `Fixed` and `Left` hold `- None.`, no product file changed, no `checks/conform-01.json` is written, and `## Checks` names `checks/01.json`

#### Scenario: A fix is checked

- **WHEN** `conform-part` renames a private helper in part `01`
- **THEN** it runs `bdk check run <run-dir> conform-01 --at part --changed HEAD` after the rename, and `## Checks` names `checks/conform-01.json`

### Requirement: Resolve a merge conflict

`resolve-conflict` SHALL take `<change> <part-id> [--run-dir <path>]`, where `<part-id>` is the part whose branch the execute lead was merging when git stopped on conflicts. It SHALL run in the checkout holding the merge and SHALL stop, changing nothing, when no file is unmerged (`git diff --name-only --diff-filter=U` prints nothing). For each unmerged file it SHALL read both sides and what each side was for - the part `<part-id>` and every part of the Change whose `files` list that file, with their tasks and acceptance scenarios - and SHALL edit the file so it holds what both sides meant, without conflict markers. It SHALL edit only the unmerged files. It SHALL NOT stage, commit, abort or continue the merge, and SHALL NOT change git history or the index; the lead does. It SHALL run `bdk check run <run-dir> merge-<part-id> --at part --scope <path>...` with every unmerged file and every file of the parts it read, and on `fail` fix what the output shows within the unmerged files, at most three runs in all.

It SHALL write `<run-dir>/execute/merge-<part-id>.md`: the first line `Status: done` or `Status: blocker`, then `## Resolved files` (one line per file: what each side added and how the result keeps both), `## Checks` (`checks/merge-<part-id>.json: <verdict>`), `## Blocker` only with `Status: blocker` (`Kind: conflict | other`, `Evidence:`, `Proposal:`), and `## Decisions taken without the user`. When the two sides contradict each other, so that no file keeps both (the same function returning different values for the same input), it SHALL leave that file as it is and report `Kind: conflict`. `Status: done` SHALL require no conflict marker in any resolved file and a `pass` or `none` check verdict. It SHALL reply with the status line and the report path only.

#### Scenario: Two functions added at the same place

- **WHEN** part `01` added `income(entries)` and part `02` added `expenses(entries)` at the end of `src/ledger.js`, and merging part `02` stopped on a conflict in that file
- **THEN** `src/ledger.js` holds both functions and no conflict marker, the merge is still in progress with nothing staged, `checks/merge-02.json` passes, and `execute/merge-02.md` starts with `Status: done`

#### Scenario: Nothing to resolve

- **WHEN** `resolve-conflict` runs in a checkout with no unmerged file
- **THEN** it changes no file, writes no report, and its reply says that no merge conflict was found

### Requirement: Part from another directory

`implement-part`, `conform-part` and `resolve-conflict` SHALL take `--parts <dir>`. With it, the part SHALL be `<dir>/<part-id>.md` instead of `openspec/changes/<change>/plan/parts/<part-id>.md`; everything else, the run directory, the reports, the checks and the work directory, SHALL be as without it.

#### Scenario: Fix part

- **WHEN** `implement-part monthly-report 03 --run-dir <run> --parts <run>/review/round-1/fixes/parts` runs
- **THEN** it reads the contract of `<run>/review/round-1/fixes/parts/03.md` and writes `<run>/execute/part-03.md`

### Requirement: Repair a red wave check

`resolve-conflict` SHALL also take `<change> --wave <n> --base <commit> [--run-dir <path>] [--parts <dir>]`, started by the execute lead when the wave check `checks/wave-<n>.json` of wave `<n>` is red after every part of the wave is on the Change branch. It SHALL run in the main checkout on the Change branch with no merge in progress. It SHALL read the red checks of `checks/wave-<n>.json` and their output files, the parts of wave `<n>` (the parts directory's parts whose `wave` is `<n>`) with their tasks and acceptance scenarios, and the diff `git diff <commit>` of those parts' files, and SHALL fix the cause within the `files` of the wave's parts, keeping what each part meant. It SHALL NOT change git history or the index. It SHALL run `bdk check run <run-dir> wave-<n> --at wave --changed <commit>` after its fix and, on `fail`, fix again, at most three runs in all.

It SHALL write `<run-dir>/execute/wave-<n>.md`, replacing an earlier one: the first line `Status: done` or `Status: blocker`, then `## Repaired` (one line per change: file, which parts it reconciles, what changed), `## Checks` (`checks/wave-<n>.json: <verdict>`), `## Blocker` only with `Status: blocker` (`Kind: conflict` when two parts contradict each other so no file keeps both, `Kind: other` when checks stay red, with `Evidence:` and `Proposal:`), and `## Decisions taken without the user`. `Status: done` SHALL require a `pass` or `none` verdict of its last run. It SHALL reply with the status line and the report path only. When `checks/wave-<n>.json` is missing or its verdict is not `fail`, it SHALL change nothing, write no report, and reply that the wave check is not red.

#### Scenario: Two green parts red together

- **WHEN** part `01` renamed `total()` to `sum()` and updated its callers, part `02` of the same wave added a new caller of `total()`, both parts passed alone, and `checks/wave-1.json` fails with `total is not a function`
- **THEN** `resolve-conflict add-totals --wave 1 --base <commit>` changes the new caller to `sum()`, `checks/wave-1.json` passes, `execute/wave-1.md` starts with `Status: done`, and nothing is staged or committed

#### Scenario: Wave check not red

- **WHEN** `resolve-conflict add-totals --wave 1 --base <commit>` runs and `checks/wave-1.json` has the verdict `pass`
- **THEN** it changes no file, writes no report, and its reply says that the wave check is not red

### Requirement: Eval case of a test of present behaviour

The suite SHALL hold the block case `implement-part-present-behaviour` on the fixture `tally-total-untested.sh` with fix part `02` written: the part lists `Empty ledger` with ` (behaviour present)`, and the case grades `Status: done`, the report line ending `; green at first run (behaviour present); green seen`, and a passing `checks/02-red.json`.

#### Scenario: Present behaviour built

- **WHEN** `implement-part-present-behaviour` runs with the plugin
- **THEN** its graders pass: `execute/part-02.md` starts with `Status: done` and holds the green-at-first-run line, and the test file holds a test of the empty ledger

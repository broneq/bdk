## MODIFIED Requirements

### Requirement: Acceptance tests first

`implement-part` SHALL write, before the code of the tasks, at least one test per acceptance scenario of the part that encodes the scenario's WHEN and THEN, in the project's test conventions, inside the part's `files`. It SHALL run those tests with `bdk check run <run-dir> <part-id>-red --at part --kind test --scope <test files>` and see them fail because the behaviour is missing, not because the test is broken. A verdict `none` (no `tools.test` item runs at `part` on these files) SHALL be a blocker of kind `environment` naming `/bdk:setup`. Then it SHALL implement the tasks in their order, following the rules and project instructions it read.

#### Scenario: Red then green

- **WHEN** `implement-part` builds part `01` of `add-csv-export` with four acceptance scenarios
- **THEN** its report lists four scenarios under `Acceptance tests`, each with its test, `red seen` and `green seen`, and `checks/01-red.json` holds a red test check and `at` `part`

#### Scenario: Whole-suite item left out of the red run

- **WHEN** the configuration has the `tools.test` items `vitest-related` (`command: pnpm vitest related --run {files}`, `when: [part]`) and `unit` (`command: pnpm test`, `when: [wave, review]`), and `implement-part` runs its red run
- **THEN** `checks/<part-id>-red.json` holds one check, `test vitest-related`, and `pnpm test` does not run

### Requirement: Part checks

After the code, `implement-part` SHALL run `bdk check run <run-dir> <part-id> --at part --changed HEAD`, so the items of the `part` point run on the files the part changed, and, on a `fail` verdict, fix what the failing check's output shows and run it again, at most three runs in all. `Status: done` SHALL require a `pass` verdict, or `none` when no item runs at `part` on these files, which the report states. A verdict still `fail` after the third run SHALL be a blocker of kind `other` with the failing check's tail as evidence; a check that cannot run (a missing tool, no `tools.test` item at `part` so no red can be seen) SHALL be a blocker of kind `environment`.

#### Scenario: Checks stay red

- **WHEN** the part's test check still fails after three runs
- **THEN** the report has `Status: blocker`, `Kind: other`, and the failing check's output path as evidence

#### Scenario: Only the part point runs

- **WHEN** the configuration has the `tools.lint` items `eslint-changed` (`command: pnpm eslint {files}`, `when: [part]`) and `tsc` (`command: pnpm tsc --noEmit`, `when: [wave, review]`), and part `02` changed `src/a.ts`
- **THEN** `checks/02.json` holds `lint eslint-changed` with the command `pnpm eslint src/a.ts`, and `tsc` did not run

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

## ADDED Requirements

### Requirement: Repair a red wave check

`resolve-conflict` SHALL also take `<change> --wave <n> --base <commit> [--run-dir <path>] [--parts <dir>]`, started by the execute lead when the wave check `checks/wave-<n>.json` of wave `<n>` is red after every part of the wave is on the Change branch. It SHALL run in the main checkout on the Change branch with no merge in progress. It SHALL read the red checks of `checks/wave-<n>.json` and their output files, the parts of wave `<n>` (the parts directory's parts whose `wave` is `<n>`) with their tasks and acceptance scenarios, and the diff `git diff <commit>` of those parts' files, and SHALL fix the cause within the `files` of the wave's parts, keeping what each part meant. It SHALL NOT change git history or the index. It SHALL run `bdk check run <run-dir> wave-<n> --at wave --changed <commit>` after its fix and, on `fail`, fix again, at most three runs in all.

It SHALL write `<run-dir>/execute/wave-<n>.md`, replacing an earlier one: the first line `Status: done` or `Status: blocker`, then `## Repaired` (one line per change: file, which parts it reconciles, what changed), `## Checks` (`checks/wave-<n>.json: <verdict>`), `## Blocker` only with `Status: blocker` (`Kind: conflict` when two parts contradict each other so no file keeps both, `Kind: other` when checks stay red, with `Evidence:` and `Proposal:`), and `## Decisions taken without the user`. `Status: done` SHALL require a `pass` or `none` verdict of its last run. It SHALL reply with the status line and the report path only. When `checks/wave-<n>.json` is missing or its verdict is not `fail`, it SHALL change nothing, write no report, and reply that the wave check is not red.

#### Scenario: Two green parts red together

- **WHEN** part `01` renamed `total()` to `sum()` and updated its callers, part `02` of the same wave added a new caller of `total()`, both parts passed alone, and `checks/wave-1.json` fails with `total is not a function`
- **THEN** `resolve-conflict add-totals --wave 1 --base <commit>` changes the new caller to `sum()`, `checks/wave-1.json` passes, `execute/wave-1.md` starts with `Status: done`, and nothing is staged or committed

#### Scenario: Wave check not red

- **WHEN** `resolve-conflict add-totals --wave 1 --base <commit>` runs and `checks/wave-1.json` has the verdict `pass`
- **THEN** it changes no file, writes no report, and its reply says that the wave check is not red

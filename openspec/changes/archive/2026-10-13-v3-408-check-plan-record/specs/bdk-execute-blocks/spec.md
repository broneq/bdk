## MODIFIED Requirements

### Requirement: Limits on what a block changes

Both blocks SHALL edit only paths listed in the part's `files`, plus their own files under the run directory. They SHALL NOT change git history or the index (no commit, stash, reset, checkout or restore of paths, rebase, merge, add), SHALL NOT install packages, and SHALL NOT run a command that reaches the network, spends money or needs credentials. They SHALL run the project's checks only as a check run (spec `bdk-cli/check`: `bdk check plan`, then each printed line as its own Bash call from the project root with the printed Bash timeout, one after another and character for character, then `bdk check record` with the exit code each call reported), and SHALL run no other test, lint or build command; the one other command they MAY run is `openspec validate <change> --strict`, on a part that changes a spec delta. When the work needs anything outside these limits, `implement-part` SHALL stop with a blocker and `conform-part` SHALL leave the item.

#### Scenario: File outside the part

- **WHEN** a task of part `02` can only be done by changing `src/ledger.js`, which is not in the part's `files`
- **THEN** `implement-part` does not edit `src/ledger.js` and reports `Status: blocker` with `Kind: plan-defect` naming the file

### Requirement: Acceptance tests first

`implement-part` SHALL write, before the code of the tasks, at least one test per acceptance scenario of the part that encodes the scenario's WHEN and THEN, in the project's test conventions, inside the part's `files`. It SHALL run those tests as the check run `<part-id>-red` (spec `bdk-cli/check`: `bdk check plan`, then each printed line as its own Bash call from the project root with the printed Bash timeout, one after another and character for character, then `bdk check record` with the exit code each call reported), planned with `bdk check plan <run-dir> <part-id>-red --at part --kind test --tests <test files>`, and see them fail because the behaviour is missing, not because the test is broken. It SHALL count a test as seen red only when it saw that test's own failure: when the tail `bdk check record` prints does not show every acceptance test failing, it SHALL read the red check's output file. A verdict `none` (no `tools.test` item runs at `part` on these test files) SHALL be a blocker of kind `environment` naming `/bdk:setup`. Then it SHALL implement the tasks in their order, following the rules and project instructions it read.

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

#### Scenario: The red run is the agent's own call

- **WHEN** the configuration has the `tools.test` item `playwright-changed` with `command: npm run test:e2e -- {files}`, `paths: ["e2e/**/*.spec.ts"]` and `when: [part]`, and `implement-part` writes the acceptance test `e2e/export.spec.ts` for part `02`
- **THEN** its transcript holds a Bash call `npm run test:e2e -- e2e/export.spec.ts </dev/null > <run-dir>/checks/02-red/test-playwright-changed.txt 2>&1`, and `checks/02-red.json` holds that command, the project root as `cwd`, the call's exit code and the verdict

### Requirement: Part checks

After the code, `implement-part` SHALL pick the tests that check the part: its acceptance tests, the existing tests of the modules the part changed, and the E2E specs of the flows the part touched. It SHALL run the check run `<part-id>` (spec `bdk-cli/check`: `bdk check plan`, then each printed line as its own Bash call from the project root with the printed Bash timeout, one after another and character for character, then `bdk check record` with the exit code each call reported), planned with `bdk check plan <run-dir> <part-id> --at part --changed HEAD --tests <picked tests>`, so the test items of the `part` point run on the picked tests and the lint and build items on the files the part changed, and a test item none of whose files was picked does not run. On a `fail` verdict it SHALL fix what the failing check's output shows and run the check run again, at most three runs in all. `Status: done` SHALL require a `pass` verdict, or `none` when no item runs at `part` on these files, which the report states. A verdict still `fail` after the third run SHALL be a blocker of kind `other` with the failing check's tail as evidence; a check that cannot run (a missing tool, a call the permission system refuses, no `tools.test` item at `part` so no red can be seen) SHALL be a blocker of kind `environment`.

#### Scenario: Checks stay red

- **WHEN** the part's test check still fails after three runs
- **THEN** the report has `Status: blocker`, `Kind: other`, and the failing check's output path as evidence

#### Scenario: Only the part point runs

- **WHEN** the configuration has the `tools.lint` items `eslint-changed` (`command: pnpm eslint {files}`, `when: [part]`) and `tsc` (`command: pnpm tsc --noEmit`, `when: [wave, review]`), and part `02` changed `src/a.ts`
- **THEN** `checks/02.json` holds `lint eslint-changed` with the command `pnpm eslint src/a.ts`, and `tsc` did not run

#### Scenario: Unchanged E2E spec of a touched flow

- **WHEN** part `03` changes `src/checkout.ts`, the configuration has the `tools.test` item `playwright-changed` with `paths: ["e2e/**/*.spec.ts"]` and `when: [part]`, and `e2e/checkout.spec.ts` tests the checkout flow and is unchanged
- **THEN** `checks/03.json` holds `test playwright-changed` with the command naming `e2e/checkout.spec.ts`

#### Scenario: No E2E spec picked

- **WHEN** part `04` changes only `src/format.ts`, which no E2E flow reaches
- **THEN** `checks/04.json` lists `test playwright-changed` under `skipped` and no E2E command ran

### Requirement: Implementer report

`implement-part` SHALL write `<run-dir>/execute/part-<part-id>.md`, replacing an earlier one, in the body of D7: the first line `Status: done` or `Status: blocker`; then `## Acceptance tests` (one line per acceptance scenario: the scenario, the test, and the line ending exactly `; red seen; green seen`, or `; green at first run (behaviour present); green seen` for a scenario the part marks ` (behaviour present)`, with nothing between or after; a remark about a test goes under `Decisions taken without the user`), `## Changed files` (every path it created, changed or deleted), `## Checks` (`checks/<id>.json: <verdict>` per check run, the part check's line followed by one indented line per picked test: its path and why it was picked), `## Blocker` only with `Status: blocker` (`Kind: plan-defect | environment | other`, `Evidence:`, `Proposal:`), and `## Decisions taken without the user`. An empty section SHALL hold `- None.` The block SHALL reply with the status line and the report path only.

When it is started again for a part whose files already hold work (a retry), it SHALL read the earlier report and continue from the files as they are. When `<run-dir>/execute/conform-<part-id>.md` says `Verdict: FAIL`, it SHALL treat each `Left` item naming a task as work still to do and a red conform check as a check to make green.

#### Scenario: Part done

- **WHEN** `implement-part` finishes part `01` with green checks
- **THEN** `execute/part-01.md` starts with `Status: done`, lists `checks/01.json: pass` under `Checks`, has no `## Blocker` section, and the reply is that line and the path

#### Scenario: Retry after a failed conform

- **WHEN** `implement-part` runs part `01` again and `execute/conform-01.md` says `Verdict: FAIL` with a `Left` item `src/csv.js:12 task 1: quotes not doubled`
- **THEN** it adds a test for the doubling, sees it red, makes it green, and its new report says `Status: done`

### Requirement: Conformer report

After its fixes, `conform-part` SHALL run the check run `conform-<part-id>` (spec `bdk-cli/check`: `bdk check plan`, then each printed line as its own Bash call from the project root with the printed Bash timeout, one after another and character for character, then `bdk check record` with the exit code each call reported), planned with `bdk check plan <run-dir> conform-<part-id> --at part --changed HEAD --tests <picked tests>`, when it edited at least one file, picking the tests that check the code it edited (the tests the implementer report names for the part check, and the existing tests of the modules it edited). When it edited none, it SHALL run no check and its `## Checks` section SHALL name the implementer's last part check (`checks/<part-id>.json: pass, unchanged`). It SHALL write `<run-dir>/execute/conform-<part-id>.md`, replacing an earlier one, in the body of D7: the first line `Verdict: PASS` or `Verdict: FAIL`, then `## Fixed` (one line per fix: file and line, the rule id, instruction file or task, what changed), `## Left` (one line per item left: file and line, its source, what is wrong, why it was left) and `## Checks` (`checks/conform-<part-id>.json: <verdict>`, or the unchanged implementer check). An empty section SHALL hold `- None.` The verdict SHALL be `FAIL` if and only if the check verdict is `fail`, a `Left` item names a task of the part, or the implementer report is missing or not done. A rule or instruction left SHALL NOT fail the part by itself (D2 of the skills decisions); the review reads it. The block SHALL reply with the verdict line and the report path only.

#### Scenario: Clean part passes

- **WHEN** the diff of part `01` breaks no rule, instruction or task and its checks pass
- **THEN** `execute/conform-01.md` starts with `Verdict: PASS`, `Fixed` and `Left` hold `- None.`, no product file changed, no `checks/conform-01.json` is written, and `## Checks` names `checks/01.json`

#### Scenario: A fix is checked

- **WHEN** `conform-part` renames a private helper in part `01`
- **THEN** it runs `bdk check plan <run-dir> conform-01 --at part --changed HEAD --tests <picked tests>`, each printed line and `bdk check record <run-dir> conform-01` after the rename, and `## Checks` names `checks/conform-01.json`

### Requirement: Resolve a merge conflict

`resolve-conflict` SHALL take `<change> <part-id> [--run-dir <path>]`, where `<part-id>` is the part whose branch the execute lead was merging when git stopped on conflicts. It SHALL run in the checkout holding the merge and SHALL stop, changing nothing, when no file is unmerged (`git diff --name-only --diff-filter=U` prints nothing). For each unmerged file it SHALL read both sides and what each side was for - the part `<part-id>` and every part of the Change whose `files` list that file, with their tasks and acceptance scenarios - and SHALL edit the file so it holds what both sides meant, without conflict markers. It SHALL edit only the unmerged files. It SHALL NOT stage, commit, abort or continue the merge, and SHALL NOT change git history or the index; the lead does. It SHALL run the check run `merge-<part-id>` (spec `bdk-cli/check`: `bdk check plan`, then each printed line as its own Bash call from the project root with the printed Bash timeout, one after another and character for character, then `bdk check record` with the exit code each call reported), planned with `bdk check plan <run-dir> merge-<part-id> --at part --scope <path>... --tests <path>...`, with every unmerged file and every file of the parts it read as `--scope`, and as `--tests` the acceptance tests of those parts and the existing tests of the unmerged files, and on `fail` fix what the output shows within the unmerged files, at most three check runs in all.

It SHALL write `<run-dir>/execute/merge-<part-id>.md`: the first line `Status: done` or `Status: blocker`, then `## Resolved files` (one line per file: what each side added and how the result keeps both), `## Checks` (`checks/merge-<part-id>.json: <verdict>`), `## Blocker` only with `Status: blocker` (`Kind: conflict | other`, `Evidence:`, `Proposal:`), and `## Decisions taken without the user`. When the two sides contradict each other, so that no file keeps both (the same function returning different values for the same input), it SHALL leave that file as it is and report `Kind: conflict`. `Status: done` SHALL require no conflict marker in any resolved file and a `pass` or `none` check verdict. It SHALL reply with the status line and the report path only.

#### Scenario: Two functions added at the same place

- **WHEN** part `01` added `income(entries)` and part `02` added `expenses(entries)` at the end of `src/ledger.js`, and merging part `02` stopped on a conflict in that file
- **THEN** `src/ledger.js` holds both functions and no conflict marker, the merge is still in progress with nothing staged, `checks/merge-02.json` passes, and `execute/merge-02.md` starts with `Status: done`

#### Scenario: Nothing to resolve

- **WHEN** `resolve-conflict` runs in a checkout with no unmerged file
- **THEN** it changes no file, writes no report, and its reply says that no merge conflict was found

### Requirement: Repair a red wave check

`resolve-conflict` SHALL also take `<change> --wave <n> --base <commit> [--run-dir <path>] [--parts <dir>]`, started by the execute lead when the wave check `checks/wave-<n>.json` of wave `<n>` is red after every part of the wave is on the Change branch. It SHALL run in the main checkout on the Change branch with no merge in progress. It SHALL read the red checks of `checks/wave-<n>.json` and their output files, the parts of wave `<n>` (the parts directory's parts whose `wave` is `<n>`) with their tasks and acceptance scenarios, and the diff `git diff <commit>` of those parts' files, and SHALL fix the cause within the `files` of the wave's parts, keeping what each part meant. It SHALL NOT change git history or the index. It SHALL run the check run `wave-<n>` (spec `bdk-cli/check`: `bdk check plan`, then each printed line as its own Bash call from the project root with the printed Bash timeout, one after another and character for character, then `bdk check record` with the exit code each call reported), planned with `bdk check plan <run-dir> wave-<n> --at wave --changed <commit>`, after its fix and, on `fail`, fix again, at most three check runs in all.

It SHALL write `<run-dir>/execute/wave-<n>.md`, replacing an earlier one: the first line `Status: done` or `Status: blocker`, then `## Repaired` (one line per change: file, which parts it reconciles, what changed), `## Checks` (`checks/wave-<n>.json: <verdict>`), `## Blocker` only with `Status: blocker` (`Kind: conflict` when two parts contradict each other so no file keeps both, `Kind: other` when checks stay red, with `Evidence:` and `Proposal:`), and `## Decisions taken without the user`. `Status: done` SHALL require a `pass` or `none` verdict of its last run. It SHALL reply with the status line and the report path only. When `checks/wave-<n>.json` is missing or its verdict is not `fail`, it SHALL change nothing, write no report, and reply that the wave check is not red.

#### Scenario: Two green parts red together

- **WHEN** part `01` renamed `total()` to `sum()` and updated its callers, part `02` of the same wave added a new caller of `total()`, both parts passed alone, and `checks/wave-1.json` fails with `total is not a function`
- **THEN** `resolve-conflict add-totals --wave 1 --base <commit>` changes the new caller to `sum()`, `checks/wave-1.json` passes, `execute/wave-1.md` starts with `Status: done`, and nothing is staged or committed

#### Scenario: Wave check not red

- **WHEN** `resolve-conflict add-totals --wave 1 --base <commit>` runs and `checks/wave-1.json` has the verdict `pass`
- **THEN** it changes no file, writes no report, and its reply says that the wave check is not red

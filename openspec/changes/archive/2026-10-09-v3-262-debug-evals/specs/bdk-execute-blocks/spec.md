## MODIFIED Requirements

### Requirement: Acceptance tests first

`implement-part` SHALL write, before the code of the tasks, at least one test per acceptance scenario of the part that encodes the scenario's WHEN and THEN, in the project's test conventions, inside the part's `files`. It SHALL run those tests with `bdk check run <run-dir> <part-id>-red --at part --kind test --scope <test files>` and see them fail because the behaviour is missing, not because the test is broken. It SHALL count a test as seen red only when it saw that test's own failure: when the tail the command prints does not show every acceptance test failing, it SHALL read the red check's output file. A verdict `none` (no `tools.test` item runs at `part` on these files) SHALL be a blocker of kind `environment` naming `/bdk:setup`. Then it SHALL implement the tasks in their order, following the rules and project instructions it read.

#### Scenario: Red then green

- **WHEN** `implement-part` builds part `01` of `add-csv-export` with four acceptance scenarios
- **THEN** its report lists four scenarios under `Acceptance tests`, each line ending `; red seen; green seen`, and `checks/01-red.json` holds a red test check and `at` `part`

#### Scenario: Whole-suite item left out of the red run

- **WHEN** the configuration has the `tools.test` items `vitest-related` (`command: pnpm vitest related --run {files}`, `when: [part]`) and `unit` (`command: pnpm test`, `when: [wave, review]`), and `implement-part` runs its red run
- **THEN** `checks/<part-id>-red.json` holds one check, `test vitest-related`, and `pnpm test` does not run

#### Scenario: A failure above the tail

- **WHEN** two acceptance tests fail in the red run and the 20-line tail printed under the red check shows only the second test's failure
- **THEN** `implement-part` reads the output file and finds the first test's failure there before it writes any code, and its report line for the first test ends `; red seen; green seen` with no note

### Requirement: Implementer report

`implement-part` SHALL write `<run-dir>/execute/part-<part-id>.md`, replacing an earlier one, in the body of D7: the first line `Status: done` or `Status: blocker`; then `## Acceptance tests` (one line per acceptance scenario: the scenario, the test, and the line ending exactly `; red seen; green seen`, with nothing between or after; a remark about a test goes under `Decisions taken without the user`), `## Changed files` (every path it created, changed or deleted), `## Checks` (`checks/<id>.json: <verdict>` per check run), `## Blocker` only with `Status: blocker` (`Kind: plan-defect | environment | other`, `Evidence:`, `Proposal:`), and `## Decisions taken without the user`. An empty section SHALL hold `- None.` The block SHALL reply with the status line and the report path only.

When it is started again for a part whose files already hold work (a retry), it SHALL read the earlier report and continue from the files as they are. When `<run-dir>/execute/conform-<part-id>.md` says `Verdict: FAIL`, it SHALL treat each `Left` item naming a task as work still to do and a red conform check as a check to make green.

#### Scenario: Part done

- **WHEN** `implement-part` finishes part `01` with green checks
- **THEN** `execute/part-01.md` starts with `Status: done`, lists `checks/01.json: pass` under `Checks`, has no `## Blocker` section, and the reply is that line and the path

#### Scenario: Retry after a failed conform

- **WHEN** `implement-part` runs part `01` again and `execute/conform-01.md` says `Verdict: FAIL` with a `Left` item `src/csv.js:12 task 1: quotes not doubled`
- **THEN** it adds a test for the doubling, sees it red, makes it green, and its new report says `Status: done`

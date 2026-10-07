Verdict: FAIL

## Must address
- M1 Part 01, task 1, `Interface:` says the total comes from "the existing sumAmounts(entries) of src/ledger.js". No such function exists; `src/ledger.js` exports `balance(entries)`, and design D1 says to reuse `balance`. An implementer who follows the plan would import a symbol that does not exist.
  Evidence: src/ledger.js:1 `export function balance(entries)`; `grep -rn sumAmounts src package.json` finds nothing.
- M2 Acceptance scenarios: the scenario `ledger-export` / Requirement: Export command / Scenario: Missing input file is not listed under `## Acceptance scenarios` in any part.
  Evidence: openspec/changes/add-csv-export/specs/ledger-export/spec.md:40-43; parts/01.md:16-21 and parts/02.md:17-19 list only the other five scenarios.
- M3 Part 02, task 1: design D2's error path (on a read or parse error, or when the value is not an array, write `ledger: cannot read <file>` to stderr, print nothing to stdout, set exit code 2) is not covered by any task. Task 1 covers only the success path ("exit 0").
  Evidence: design.md:23; parts/02.md:23-26; a grep for `cannot read|exit 2|Missing input file` in plan/ finds nothing.
- M4 Part 02 front matter: the part imports `toCsv` from `src/csv.js`, which part 01 creates, but it has `depends-on: []`. Both parts therefore run in wave 1 in separate worktrees, so `src/csv.js` does not exist when part 02 runs and its `test/cli.test.js` fails.
  Evidence: parts/02.md:3 `depends-on: []`, parts/02.md:25 "imports toCsv from src/csv.js"; parts/01.md:6 creates src/csv.js; `bdk plan check` output `1: 01 02`.

## Should consider
- S1 Part 02, task 2 `Verified by:` "`npm test` passes" also runs part 01's tests. That is fine once M4 is fixed, but this task could name its own check instead (for example, read the `bin` entry of package.json, or use `node --test test/cli.test.js`).
- S2 Part 02: nothing sets the executable bit on `bin/ledger.js`. The tests use `process.execPath` and npm links `bin` entries, so this is minor; consider saying so.

## Checked
- `bdk plan check`: 2 parts, 1 wave, ok. No problems listed; all parts are well under the limits (tasks 2/5, files 2-3/10, bytes 1403 and 1090/8192).
- Every task has `File:`, `Interface:` and `Verified by:` lines, and every `File:` path appears in its part's `files`.
- The scenarios No entries, Amount in cents, Description with a comma and Total line are owned once, by part 01. Export a file is owned once, by part 02.
- Design D1 (`toCsv` in src/csv.js, private `formatCents`, integer-cents formatting, tests in src/csv.test.js) is carried out by part 01, apart from the wrong reference to the total function (M1).
- Design D2's success path, shebang, `spawnSync(process.execPath, ...)` tests and `package.json` `bin` entry are carried out by part 02.
- package.json has `"type": "module"` and `"test": "node --test"`, which matches the ES module and test assumptions in the plan.
- No existing callers are affected: the plan adds new modules and changes no existing interface.
- No `Verified by:` line works by exclusion, needs network access, needs credentials or costs money.

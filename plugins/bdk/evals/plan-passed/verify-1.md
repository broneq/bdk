Verdict: PASS

## Must address

None.

## Should consider

- S1 Part 02, task 2 `Verified by:` "`npm test` passes" also runs part 01's tests; the task could name its own check (read the `bin` entry of package.json).

## Checked

- `bdk plan check`: 2 parts, 2 waves (`1: 01`, `2: 02`), no problem; every part is well under the limits.
- Every task has `File:`, `Interface:` and `Verified by:` lines, and every `File:` path appears in its part's `files`.
- Every scenario of `ledger-export` is owned once: No entries, Amount in cents, Description with a comma and Total line by part 01; Export a file and Missing input file by part 02.
- Design D1 (`toCsv` in src/csv.js reusing `balance` from src/ledger.js, private `formatCents`, integer-cents formatting, tests in src/csv.test.js) is carried out by part 01.
- Design D2 (shebang module bin/ledger.js, error line and exit code 2, `spawnSync(process.execPath, ...)` tests, `package.json` `bin` entry) is carried out by part 02, which depends on part 01 for `toCsv`.
- src/ledger.js exports `balance(entries)`; package.json has `"type": "module"` and `"test": "node --test"`.
- No `Verified by:` line works by exclusion, needs network access, needs credentials or costs money.

Verdict: PASS

## Must address
- None.

## Should consider
- S1 Parts 02-07, `## Uses`: the rule of spec `ledger` "Options" and design D2 for a missing positional argument (`<command> needs <...>`, or the checks run with the missing ones as `""`) is stated only in part 01 task 3. The later parts do not repeat it, and no task names its own behaviour. For example, part 04 task 4 does not name `import needs a file`, the very example the spec gives. Part 02 task 3 leaves `ledger account add` without a name undefined: `isName(undefined)` tests the text "undefined", which passes `^[a-z][a-z0-9-]*$`, so an account `undefined` could be added unless the implementer applies the `""` rule from the design.
- S2 Part 05 task 2 / task 4: `addRecurring` refuses a day "unless day is an integer 1-28", but neither task says which side turns the `--day` text into a number. If the command passes the text `"1"`, `Number.isInteger` refuses a valid day. The tasks should say who converts it, and how text like `3.0` or `""` is handled.
- S3 Part 01 and part 07 are at the file limit (10/10 files). Part 01 is also the largest part (6760/8192 bytes) and holds the contracts every other part uses. Any added file would need a new cut.
- S4 README.md still documents only `add` and `balance` with the version 1 book, and no part touches it. This is not required by any spec scenario.

## Checked
- `bdk plan check openspec/changes/add-household-book/plan/parts`: 7 parts, 3 waves (01 | 02 03 04 05 06 | 07), ok, no problem. Every part is within its task, file and byte limits.
- All 71 scenarios of the 8 spec deltas (ledger 17, ledger-accounts 9, ledger-categories 9, ledger-import 8, ledger-budgets 8, ledger-recurring 6, ledger-views 8, ledger-reports 6) are named exactly once under `## Acceptance scenarios`. Checked by a mechanical diff of the spec headings against the part lists: identical, no duplicates.
- Every task has `File:`, `Interface:` and `Verified by:`, and every `File:` path is in its part's `files`. No file is claimed by two parts.
- The existing code matches what the plan names: `src/book.js` (`BOOK_FILE`, `loadBook`, `saveBook`, src/book.js:5-16), `src/money.js` (`parseAmount` throws `Error`, `formatCents`, src/money.js:4-16), `bin/ledger.js` hand-written argv (bin/ledger.js:1-42), and `test/cli.test.js`. `package.json` runs `node --test`.
- Callers of the changed interfaces (`loadBook` and `saveBook` in bin/ledger.js:2,15,33 and src/book.test.js:6-24) are all rewritten by part 01 tasks 1 and 3. No other caller exists (grep over bin, src, test).
- Dependencies: parts 02-06 use only part 01 contracts and depend on 01. Part 07 uses `budgetStatus` of part 05, depends on 05 and reaches 01 through 05. Each part's `## Uses` restates the signatures it needs from earlier parts.
- Traced inputs across parts. (1) A transfer entry from part 02 has `category: null` and a `transfer` id: `categorize` (part 03) skips it, `budgetStatus` (part 05) never matches it, and every report row function (part 07) excludes it. (2) An imported row (part 04) has its amount in cents via `parseAmount` and its date normalised to `YYYY-MM-DD`: `freshRows` compares it with the book entries in those same units. (3) A recurring entry from part 05 is stored in the `recurring` shape of the part 01 Book type. `dueEntries` uses `monthsFrom`/`monthOf` of part 01 and sets `recurring: id`, matching the Entry type.
- Design decisions D1-D10 are each carried by tasks: D1 by 01/1, D2 by 01/3-4, D3 by 01/2, D4 by part 02, D5 by part 03, D6 by part 04, D7 by part 05 (day check in `addRecurring`, `--day` presence check in the command, order by position in `book.recurring`), D8 by part 06 (`io.write`), D9 by part 07, D10 by `test/helpers.js` and the rewritten version 1 tests.
- Checked the report layouts by hand against `renderTable`'s contract: two-space separation, padding to the widest cell, right-aligned amounts and stripped trailing spaces give the exact category and budget tables of spec `ledger-reports`.
- `Verified by:` lines name only local `node:test` files and spec scenarios. None names commands by exclusion, and none needs the network or credentials.

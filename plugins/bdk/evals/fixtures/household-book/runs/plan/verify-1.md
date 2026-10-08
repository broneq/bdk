Verdict: PASS

## Must address
- None.

## Should consider
- S1 Part 05, tasks 2 and 4: no task says who turns the `--day` text into a number. Task 4 passes `day` to `addRecurring`, and task 2 checks "an integer 1-28" and pads it to two digits in `dueEntries`. If the command passes the string `"5"`, a check such as `Number.isInteger` refuses every day. If the book stores a string, `recurring list` and the date padding work on text. Say that the command converts the text, which texts count as whole numbers (`01`, `1.0`, `1e1`), and that `book.recurring[].day` is a number.
- S2 Part 03, task 3: the `rule` command's scenarios are verified in `test/category-cli.test.js`, and the part's `files` has no `test/rule-cli.test.js`. Design D10 says command tests go in `test/<command>-cli.test.js` and that "a spec scenario is verified by the test of the command it names". Either add `test/rule-cli.test.js` (the part has 9 of 10 files) or note the deviation.
- S3 Part 01, task 3: the `parseArgs` interface leaves out its two errors, `unknown option --<name>` and `--<name> needs a value`. The spec `ledger` "Options" states them. Part 01 tests them, but parts 02-07 depend on this exact behaviour, so the contract would be clearer with the errors in it. The same holds for the `add needs a description` error, which part 01 task 4 does not name.
- S4 Part 05, task 3: `ledger budget set <category> <amount>` does not say that it reads the amount with `readAmount`. Part 05 "Uses" lists `readAmount`, but no task in the part says which command uses it for which argument (only `recurring add` does).
- S5 Part 06, task 1: `Verified by:` names the CLI scenarios "Month and account" and "Entries without a category". Those run through `ledger list`, which only task 2 adds, so task 1 alone cannot meet them. Keep `src/filter.test.js` as task 1's check and leave the scenarios to task 2, which already lists them.
- S6 Parts 01 and 07 are at the file limit (10/10). Part 01 also carries the contracts that every other part depends on; this is acceptable but leaves no room to add files.

## Checked
- `bdk plan check`: 7 parts, 3 waves (01; 02 03 04 05 06; 07), status ok, no problem. Every part is within the limits for tasks, files and bytes.
- Every task has `File:`, `Interface:` and `Verified by:`, and each `File:` path is in its part's `files`.
- Wave 2 parts (02-06) have pairwise disjoint `files`, so they can run in parallel worktrees.
- Every scenario is owned exactly once. That is 63 scenarios in all: `ledger` 17 (Book file 4, Add an entry 5, Balance 2, Commands 2, Options 2, Today 2) -> 01; `ledger-accounts` 9 -> 02; `ledger-categories` 9 -> 03; `ledger-import` 8 -> 04; `ledger-budgets` 8 and `ledger-recurring` 6 -> 05; `ledger-views` 8 -> 06; `ledger-reports` 6 -> 07.
- Existing code matches what the plan says about it: `src/money.js:4` `parseAmount(text)` throws `Error("not an amount: ...")` and accepts a sign; `src/money.js:12` `formatCents(cents)`; `src/book.js:5` `BOOK_FILE = "ledger.json"`; `src/book.js:7,14` `loadBook`/`saveBook` (version 1, which part 01 replaces); `package.json` runs `node --test`; `bin/ledger.js` is the hand-written dispatcher that part 01 replaces.
- Callers of the changed `loadBook`/`saveBook` are `bin/ledger.js:2,15,33` and `src/book.test.js:6-24`. Part 01 rewrites both (tasks 1 and 3), and Grep finds no other caller.
- Design decisions are all carried out by tasks. D1 is part 01 task 1 (emptyBook, migration, six-collection check, atomic `.tmp` + rename, isName). D2 is part 01 task 3 (UsageError, run, readdirSync on `import.meta.dirname`, parseArgs, subcommand, openBook/writeBook, read*/require*) and task 4 (add/balance modules). D3 is part 01 task 2. D4 is part 02. D5 is part 03. D6 is part 04, including the both/neither debit-credit rule and the column choice in `readStatement`. D7 is part 05, including in-place replace, `dueEntries` ordering by the position in `book.recurring`, and the day check split between `addRecurring` and the command. D8 is part 06 (`io.write` for export). D9 is part 07 (`budgetRows` reuses `budgetStatus`, `--year` checked in the command). D10 is `test/helpers.js` in part 01 and the unit and CLI tests in each part.
- Dependencies hold. Parts 02-06 use only part 01's contracts and depend on 01. Part 07 uses `budgetStatus` from part 05 and depends on 05, and through 05 on 01.
- Each part restates what it uses from other parts in its "Uses" section: `src/cli.js` names, the `io` shape, the book shape, `src/dates.js` and `test/helpers.js` signatures. Part 07 restates `budgetStatus(book, month): { category, limit, spent, left }[]` exactly as part 05 task 1 defines it.
- Traced inputs:
  - Version 1 array -> `loadBook` migration (account `main`, category `null`) -> `add --date` -> `saveBook` version 2. This matches "Version 1 book migrated".
  - `transfer` entries carry `category: null` and `transfer: id` (part 02). Because of that, `categorize` skips them (part 03), `budgetStatus` never counts them (part 05), and reports exclude them (part 07). This matches "Transfers untouched" and "Two months".
  - Recurring `from` 2026-08-10, day 5, today 2026-10-08: `monthsFrom("2026-08","2026-10")` gives 08-05 (dropped, before `from`), then 09-05 and 10-05. This matches "Start date respected".
  - Import dedupe with k=3 and j=2 gives 1 fresh row and 2 skipped. This matches "Equal lines in one statement".
- The report table layout of part 07 task 1 (two-space separator, pad to the widest cell, right-aligned amounts, trailing spaces trimmed) reproduces the expected lines of "Two months", "Spending per category" and "Budget against spending".
- No `Verified by:` line names commands by exclusion, and none spends money, needs credentials or reaches an external system. All are local `node:test` files and spec scenarios.

Verdict: PASS
Closed: none

## Must address
- None.

## Should consider
- S9 design.md D1/D5: still open. The spec refuses `none` as a category name (specs/ledger-categories/spec.md:9, scenario "Reserved name" :16-19), but the design names only `isName` (`^[a-z][a-z0-9-]*$`, shared with account names, design.md:29) and does not say where the `none` check lives (D5, design.md:68, `addCategory(book, name)` says nothing about it). Say that `addCategory` refuses `none` with `invalid name none`.
- S10 specs/ledger/spec.md "Help lists the commands": still open. The scenario pins the summaries `Add an entry` and `Print the balance` (specs/ledger/spec.md:84), but D2 (design.md:41, :48) states no `summary` text for `add` and `balance`, and the other commands' summaries are left to the plan. State the two summaries in D2.
- S11 design.md D4/D5/D7: the error type of the pure feature modules is unstated. D2 says every error other than `UsageError` is a bug that exits 1 with a stack (design.md:39), and D6 says `readStatement` throws `UsageError` (design.md:74), but D4 `transfer` ("checks the spec's errors"), D5 `addCategory`/`addRule`, and D7 `addRecurring` ("the day check lives in `addRecurring`") and `setBudget` do not say they throw `UsageError` (imported from `src/cli.js`) or that their command translates the error. A plan that has them throw `Error` makes `ledger account add main`, `ledger transfer 5 main main` or `ledger recurring add -900 Rent --day 31` exit 1 instead of 2. Also name where `budget must be positive` and `account <name> exists` / `category <name> exists` are checked.
- S12 design.md D4: the order of the transfer checks is not stated. Spec `ledger` "Options" (specs/ledger/spec.md:95) pins `ledger transfer 10` to `transfer needs two different accounts`, which holds only if the same-account check runs before `requireAccount` (two empty names would otherwise give `no account `). Say the order: amount, then same account, then each account exists.

## Checked
- design.md was not changed since verify-2 in any way that touches the open items: grep finds no `none` rule and no `summary` text for `add`/`balance` in design.md; the working tree is clean at 038d028.
- Claims about existing code: `bin/ledger.js` parses argv by hand, handles `add` and `balance`, exits 2 via `fail` (bin/ledger.js:6-42); `parseAmount`/`formatCents` as stated (src/money.js:4-16); `BOOK_FILE`, `loadBook` (missing -> `[]`, non-array throws), `saveBook` two-space JSON with final newline (src/book.js:5-16); `npm test` is `node --test` (package.json:7), engines `>=22`; `test/cli.test.js` spawns `bin/ledger.js` in temp dirs (test/cli.test.js:8-16). Node v24.21.0's default `node --test` patterns load `src/**/*.test.js`, `src/reports/*.test.js` and every `.js` under `test/`, as D10 says.
- `import.meta.dirname` (D2) exists in Node 22 and is already used by test/cli.test.js:8; top-level `await run(...)` in an ES module exits 1 with a stack on an uncaught rejection, as D2 says.
- Every capability of the proposal has a spec delta (ledger, ledger-accounts, ledger-categories, ledger-import, ledger-budgets, ledger-recurring, ledger-views, ledger-reports); every requirement has a WHEN/THEN scenario runnable through the CLI.
- Every "What Changes" bullet maps to a decision (D1-D9); the out-of-scope items (currencies, non-CSV formats, editing entries) are not designed.
- Report scenarios recomputed against the D9/spec layout rule (two-space separators, widest-cell padding, right-aligned amounts): monthly (2380.00, 1299.50, transfer excluded), categories (64.25, 1276.75, `(none)` row), budget (-20.00 over, 299.50 ok, total 279.50 ok) all match.
- Subcommand error lists are in name order in every spec (`add, list`; `list, set`; `add, list, run`; `budget, categories, monthly`), matching D2 `subcommand`.
- Import duplicate rule k - j (two then three equal lines -> 1 imported, 2 skipped) matches D6 `freshRows` counting; the column choice and empty-file rule live in `readStatement`.
- Recurring: `monthsFrom` returns `[]` when first > last (D3); scenarios "Due months" (3 entries), "Start date respected" (2026-08-05 before start, so first is 2026-09-05) and "Not due yet" hold under the spec rule D7 implements.
- Budget arithmetic (150.50/149.50, 320.00/-20.00, 40.00/260.00) matches D7 `budgetStatus`; transfers carry category `null` so budgets, categorize and the category report skip them.
- "A failed command leaves the file unchanged" is met by one write at the end through `<path>.tmp` and rename (D1); no new dependency (D2).
- Decisions D1-D10 each state choice, reason and the losing alternatives; the diagram matches the D2 flow; risks are concrete; open questions: none.
- Plan readiness: modules, signatures, book shape and test layout are named (D1-D10).

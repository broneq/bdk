Verdict: FAIL

## Must address
- M1 specs/ledger/spec.md "Commands", scenario "Help lists the commands": the scenario says the lines after `commands:` start with `  add  ` and `  balance  `, but the same requirement prints every command in name order, and this Change adds `account`, which sorts before `add`. Read the natural way (lines 3 and 4 are `add` and `balance`), the scenario fails in the finished product. A test written to it would also break as soon as the `account` command file lands, which defeats D2's promise that features can be built in parallel without touching each other. Rewrite the scenario so it holds with every command of the Change, e.g. "the lines include `  add  ` before `  balance  `", or list the full help.
  Evidence: specs/ledger/spec.md:79 says "one line per command in name order"; :84 says "the next lines start with `  add  ` and `  balance  ` in that order"; specs/ledger-accounts/spec.md:9 adds `ledger account`; design.md D2 has help built from every module in `src/commands/` ("account" < "add").

## Should consider
- S1 design.md D2: the signature `run(argv, { cwd, env, out, err })` leaves out `write`. The same section has `bin/ledger.js` passing `write`, `io` holding `write`, and D8 using `io.write`. Make the signature list `write` too.
- S2 design.md D2: help must list commands "in name order" (spec `ledger`, "Commands"), but the design builds the list with `readdirSync` and never says to sort it. `readdirSync` order depends on the filesystem. State the sort.
- S3 design.md D2: the design does not say which directory `readdirSync` reads. It must be `src/commands/` next to `src/cli.js` (via `import.meta.dirname`), not `io.cwd`. Name it so the plan does not resolve it against the user's directory.
- S4 design.md D2 `subcommand`: the design takes the subcommand from `args[0]`, so `ledger budget --month 2026-10 list` fails with `budget needs one of list, set`. Spec `ledger` "Options" says every argument that is not an option is a positional, which makes `list` the first positional there. Either state in the spec that the subcommand is the first argument, or take it from the first positional.
- S5 specs/ledger-views "Entry filters" + specs/ledger-categories "Categories": `none` passes the name rule (`^[a-z][a-z0-9-]*$`, design D1 `isName`), so `ledger category add none` succeeds. After that, `--category none` can never select that category's entries. Refuse `none` as a category name, or document the clash.
- S6 design.md D2/D9: the shared checks include `readMonth` and `readDate`, but no year check, even though spec `ledger-reports` "Monthly report" needs `invalid year <text>`. The same goes for `unknown format <text>` (D8) and `recurring add needs --day` / `day must be 1 to 28` (D7). Name where each of these checks lives so the plan has a home for each one.
- S7 design.md D3/D7: the design does not say what `monthsFrom(first, last)` returns when `first` is after `last`, which happens with `recurring add --from` set to a later date. Say that it returns `[]`, so `recurring run` adds nothing.
- S8 specs/ledger-import "Statement import": the spec does not cover a header with both `amount` and `debit`/`credit`, or with both `description` and `payee`, or an empty file with no header line. `readStatement` (D6) must pick one behaviour for each. State the rule.

## Checked
- `bin/ledger.js` parses `process.argv` by hand, handles `add` and `balance`, and calls `process.exit(2)` on errors (bin/ledger.js:6-42).
- `parseAmount(text)` returns integer cents and throws `Error` on anything else; `formatCents(cents)` writes two decimals (src/money.js:4-16). It accepts an optional sign and up to two decimals, as the import and add specs require.
- `BOOK_FILE = "ledger.json"`, `loadBook(path = BOOK_FILE)` returns `[]` for a missing file and throws for a non-array, `saveBook(entries, path)` writes two-space JSON with a final newline (src/book.js:5-16).
- Tests use `node:test` and `node:assert/strict`, `npm test` runs `node --test` (package.json:7), and `test/cli.test.js` spawns `bin/ledger.js` in temp directories (test/cli.test.js:10-16). The default `node --test` patterns match `src/**/*.test.js` and every `.js` under `test/`, so `test/helpers.js` is loaded as a test file, which D10 acknowledges. Local Node is v24.21.0.
- Every capability in the proposal has a spec delta: ledger, ledger-accounts, ledger-categories, ledger-import, ledger-budgets, ledger-recurring, ledger-views, ledger-reports.
- Every requirement has at least one WHEN/THEN scenario that runs through the CLI.
- Every "What Changes" bullet maps to a decision: book v2 and migration (D1), dispatcher, options, help and `LEDGER_TODAY` (D2, D3), add/balance options (D2), accounts and transfers (D4), categories, rules and categorize (D5), import and duplicates (D6), budgets and recurring (D7), filters, list and export (D8), reports (D9).
- Report scenarios are consistent with the layout rule in D9 and the spec: column widths, two-space separators, right-aligned amounts, trimmed trailing spaces, the totals and the exclusion of transfers (monthly 2380.00/1299.50, categories total 1276.75, budget total 279.50 ok).
- The budget status arithmetic in the scenarios (150.50/149.50, 320.00/-20.00, 40.00/260.00) matches D7's "negated sum of the month's category entries".
- Transfer id N as distinct `transfer` ids (D4) matches "one more than the number of transfers"; transfers carry category `null`, so budgets and categorize skip them (D5, D7).
- The duplicate rule k - j (spec ledger-import) matches D6's count of equal date, description and amount on the target account.
- "A failed command leaves the file unchanged" is met by writing once at the end of the command, through a temp file and rename (D1).
- The no-dependency constraint is met (D2 rejects a parser library; only Node stdlib is used).
- Every decision states its choice, a reason, and alternatives with why they lost (D1-D10).
- The diagram matches the D2 flow: bin -> run -> command module -> book.js / feature modules -> ledger.json.
- The risks are concrete: partial writes, floating point, and a stray file in `src/commands/`. Open questions: none.
- Plan readiness: the design names the modules (`src/cli.js`, `src/dates.js`, feature modules, `src/commands/*`, `src/reports/*`), their function signatures, the book data shape, and the test layout (D10).

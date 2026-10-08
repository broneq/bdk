Verdict: PASS
Closed: M1, S1, S2, S3, S4, S5, S6, S7, S8

## Must address
- None.

## Should consider
- S9 design.md D1/D5: the spec now refuses `none` as a category name (specs/ledger-categories/spec.md:9, scenario "Reserved name"), but the design still names only `isName` (`^[a-z][a-z0-9-]*$`, shared with account names) as the name rule and does not say where the `none` check lives. Say that `addCategory` (or the `category` command) refuses `none` with `invalid name none`, so the plan does not reuse `isName` alone and let `none` through.
- S10 specs/ledger/spec.md "Help lists the commands": the scenario pins the summaries `Add an entry` and `Print the balance`, but no requirement and no design section states them; they exist only in this scenario, and the other commands' summaries are left open. State the `summary` of `add` and `balance` in design D2 (or the requirement) so the plan part that moves these commands carries the exact text.

## Checked
- M1 closed: the help scenario now asks for every line after `commands:` to be `  <name>  <summary>` in name order with `add` before `balance`, which holds with `account` sorting first (specs/ledger/spec.md:84).
- S1 closed: D2 `run(argv, { cwd, env, out, write, err })` lists `write`, matching `bin/ledger.js` in D2 and `io.write` in D8.
- S2, S3 closed: D2 reads `readdirSync(join(import.meta.dirname, "commands"))`, never `io.cwd`, and sorts by name for dispatch and help.
- S4 closed: spec `ledger` "Commands" now says a command with subcommands takes it from its first argument, consistent with D2 `subcommand(command, args, names)` using `args[0]` and with "Options" (the remaining arguments).
- S5 closed in the spec: `none` is refused as a category name with a runnable scenario (specs/ledger-categories/spec.md:16-19); its home in the design is S9.
- S6 closed: `invalid year` lives in the `report` command (D9), `unknown format` in the `export` command (D8), `day must be 1 to 28` in `addRecurring` and `recurring add needs --day` in the `recurring` command (D7).
- S7 closed: D3 `monthsFrom(first, last)` returns `[]` when `first` is after `last`.
- S8 closed: spec `ledger-import` now gives `description` over `payee`, `amount` over `debit`/`credit`, the first of two equal names, and an empty file as "no date column"; D6 places the column choice in `readStatement`.
- Claims about existing code re-checked: `bin/ledger.js` parses argv by hand, handles `add` and `balance`, exits 2 via `fail` (bin/ledger.js:6-42); its `--help` prints a single usage line today, so the new help format is a real change covered by D2.
- Unchanged sections (D1, D4, D5, D10, diagram, risks, open questions) still hold as checked in verify-1.md; the diff touches only design.md D2, D3, D6, D7, D8, D9 and the specs ledger, ledger-categories and ledger-import.
- Every requirement still has a WHEN/THEN scenario runnable through the CLI; every capability of the proposal has a spec delta.

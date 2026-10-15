#!/usr/bin/env bash
# add-csv-export from issue 7 with AC-1 to AC-4 and an empty scope log, as ledger-acceptance.sh
# leaves it, but the design answers AC-4 with a delimiter option and quotes only a label holding the
# delimiter in use: under `;` a label holding a comma is written bare, which narrows AC-3 ("A label
# holding a comma is quoted", no condition). design.md lists AC-3 as answered. Drawn from the
# `opus` 2 draft of the #423 measurement, which the verifier passed (#426).
set -euo pipefail

here="$(cd "$(dirname "$0")" && pwd)"
bash "$here/../fixtures/ledger-designed.sh"
bash "$here/../fixtures/ledger-acceptance/criteria.sh"

change=openspec/changes/add-csv-export
cat > "$change/specs/ledger-export/spec.md" <<'MD'
## Purpose

Exporting the ledger entries of a date range as a CSV file that a spreadsheet opens.

## ADDED Requirements

### Requirement: CSV export of a date range

The ledger SHALL export the entries of a date range as CSV text: a header row `date,label,amount`, then one row per entry in the order the store lists them. Amounts SHALL be written as decimal currency with two digits (`-900.00`).

#### Scenario: Entries in range

- **WHEN** the ledger holds an entry on 2026-10-01 labelled `rent` with -90000 cents and the export covers October 2026
- **THEN** the text is `date,label,amount` followed by the row `2026-10-01,rent,-900.00`

#### Scenario: Empty range

- **WHEN** no entry falls in the range
- **THEN** the text is the header row only

### Requirement: Delimiter option

The export SHALL take a `delimiter` option, `,` (the default) or `;`, and SHALL separate the fields of every row, the header included, with it. Any other value SHALL be rejected with an error naming the allowed values.

#### Scenario: Semicolon delimiter

- **WHEN** the export of October 2026 with one rent entry of -90000 cents runs with `delimiter: ";"`
- **THEN** the text is `date;label;amount` followed by the row `2026-10-01;rent;-900.00`

#### Scenario: Unknown delimiter

- **WHEN** the export runs with `delimiter: "|"`
- **THEN** it throws an error naming `,` and `;`

### Requirement: Field quoting

A field holding the delimiter in use, a double quote or a line break SHALL be quoted, with inner double quotes doubled. Any other field SHALL be written as it is.

#### Scenario: Label with a comma

- **WHEN** an entry is labelled `food, drinks` and the export runs with the default delimiter
- **THEN** its row holds `"food, drinks"` as the label field

#### Scenario: Comma label under a semicolon delimiter

- **WHEN** an entry is labelled `food, drinks` and the export runs with `delimiter: ";"`
- **THEN** its label field is `food, drinks` without quotes

#### Scenario: Label with a semicolon under a semicolon delimiter

- **WHEN** an entry is labelled `rent; october` and the export runs with `delimiter: ";"`
- **THEN** its row holds `"rent; october"` as the label field
MD

cat > "$change/design.md" <<'MD'
# Design

## Context

The store keeps entries as `{ date, label, amount }` with amounts in integer cents (`src/store.js:5`) and lists a date range with `listEntries` (`src/store.js:12`). `formatCents` (`src/format.js:2`) is the only amount formatter. Nothing exports today.

## Goals / Non-Goals

**Goals:** CSV text of a date range that a spreadsheet opens, with a semicolon option for decimal-comma locales.

**Non-Goals:** importing CSV; a command-line entry point.

## Decisions

### D1. A pure function `exportCsv({ from, to, delimiter })` in a new `src/export.js`

It reads `listEntries({ from, to })`, formats each amount with `formatCents`, quotes fields per D3 and returns the text. Alternatives: writing a file directly - lost, the caller decides where the text goes and a pure function is testable without the file system; streaming rows - lost, an in-memory ledger is already fully in memory.

### D2. A `delimiter` option, `,` by default, `;` allowed

AC-4 asks for a semicolon in decimal-comma locales. The option takes `,` or `;` and rejects anything else, so a typo fails loudly instead of writing a file no spreadsheet splits. Amounts stay `-900.00` under both. Alternatives: detecting the locale - lost, the export has no locale to read and a spreadsheet's locale is the user's, not the process's; any single character - lost, no AC asks for it and every extra delimiter widens the quoting rules.

### D3. Quote a field only when it holds the delimiter in use, a double quote or a line break

This is the RFC 4180 rule with the delimiter in use in place of the comma: under `;`, a comma is no separator, so a spreadsheet reads `food, drinks` as one field without quotes. Inner double quotes are doubled. Alternatives: quoting every field - lost, it doubles the size of the common case and makes the AC-1 row `"2026-10-01","rent","-900.00"`; always quoting a comma - lost, under `;` it adds quotes that carry no meaning.

## Acceptance

- AC-1: requirement "CSV export of a date range", scenario "Entries in range".
- AC-2: requirement "CSV export of a date range", scenario "Empty range".
- AC-3: requirement "Field quoting", scenario "Label with a comma".
- AC-4: requirement "Delimiter option", scenario "Semicolon delimiter".

## Diagrams

```mermaid
flowchart LR
  S["listEntries(from, to)"] -->|"entries"| E["exportCsv"]
  F["formatCents"] -->|"amount text"| E
  O["delimiter option"] --> E
  E -->|"CSV text"| C["caller"]
```

## Risks / Trade-offs

- [A large ledger builds one large string] -> the store is in memory already; streaming waits for a persistent store.
- [A spreadsheet opened in a comma locale reads a `;` file as one column] -> the default stays `,`; the caller chooses `;` only for a decimal-comma locale.

## Open Questions

None.
MD
grep -q "without quotes" "$change/specs/ledger-export/spec.md"

git add .
git -c user.name="BDK eval" -c user.email="eval@example.invalid" commit --quiet -m "docs: add-csv-export design with a delimiter option"

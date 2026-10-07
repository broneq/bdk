#!/usr/bin/env bash
# Shared fixture: ledger-explored.sh plus a spec delta and a sound design for
# add-csv-export, as design-draft leaves them. Verifier cases start here.
set -euo pipefail

here="$(cd "$(dirname "$0")" && pwd)"
bash "$here/ledger-explored.sh"

change=openspec/changes/add-csv-export
mkdir -p "$change/specs/ledger-export"
cat > "$change/specs/ledger-export/spec.md" <<'MD'
## Purpose

Exporting the ledger entries of a date range as a CSV file that a spreadsheet opens.

## ADDED Requirements

### Requirement: CSV export of a date range

The ledger SHALL export the entries of a date range as CSV text: a header row `date,label,amount`, then one row per entry in the order the store lists them. Amounts SHALL be written as decimal currency with two digits (`-900.00`). A label holding a comma, a double quote or a line break SHALL be quoted, with inner double quotes doubled.

#### Scenario: Entries in range

- **WHEN** the ledger holds an entry on 2026-10-01 labelled `rent` with -90000 cents and the export covers October 2026
- **THEN** the text is `date,label,amount` followed by the row `2026-10-01,rent,-900.00`

#### Scenario: Label with a comma

- **WHEN** an entry is labelled `food, drinks`
- **THEN** its row holds `"food, drinks"` as the label field

#### Scenario: Empty range

- **WHEN** no entry falls in the range
- **THEN** the text is the header row only
MD

cat > "$change/design.md" <<'MD'
# Design

## Context

The store keeps entries as `{ date, label, amount }` with amounts in integer cents (`src/store.js:5`) and lists a date range with `listEntries` (`src/store.js:12`). `formatCents` (`src/format.js:2`) is the only amount formatter. Nothing exports today.

## Goals / Non-Goals

**Goals:** CSV text of a date range that a spreadsheet opens.

**Non-Goals:** importing CSV; a command-line entry point.

## Decisions

### D1. A pure function `exportCsv({ from, to })` in a new `src/export.js`

It reads `listEntries({ from, to })`, formats each amount with `formatCents`, quotes labels per RFC 4180 and returns the text. Alternatives: writing a file directly - lost, the caller decides where the text goes and a pure function is testable without the file system; streaming rows - lost, an in-memory ledger is already fully in memory.

### D2. Comma delimiter, decimal amounts

Comma and `-900.00`, as RFC 4180 and `formatCents` already give. Alternative: semicolon for locales with a decimal comma - lost, no user asked for it and the proposal names a spreadsheet, which reads RFC 4180.

## Diagrams

```mermaid
flowchart LR
  S["listEntries(from, to)"] -->|"entries"| E["exportCsv"]
  F["formatCents"] -->|"amount text"| E
  E -->|"CSV text"| C["caller"]
```

## Risks / Trade-offs

- [A large ledger builds one large string] -> the store is in memory already; streaming waits for a persistent store.
- [A spreadsheet in a decimal-comma locale splits `-900.00` wrongly] -> the delimiter is one constant; a later Change can make it an option.

## Open Questions

None.
MD

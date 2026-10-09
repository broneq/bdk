#!/usr/bin/env bash
# Shared fixture: tiny-ledger configured for BDK, with the OpenSpec Change
# add-csv-export ready to plan (proposal, spec delta, design; no plan parts),
# written into the current directory. The BDK schema is copied from this
# plugin. See ../README.md, "Shared fixtures".
set -euo pipefail

here="$(cd "$(dirname "$0")" && pwd)"
bash "$here/tiny-ledger.sh"

mkdir -p .bdk
cat > .bdk/settings.yaml <<'YAML'
# BDK project settings. Resolved values with their origins: bdk config show
languages: [javascript]
tools:
  test:
    - id: node-test
      command: npm test
      when: [wave, review]
    - id: node-test-changed
      command: node --test {files}
      paths: ["**/*.test.js"]
      when: [part]
YAML

mkdir -p openspec/schemas openspec/specs openspec/changes/archive
cp -R "$here/../../openspec/schemas/bdk" openspec/schemas/bdk
cat > openspec/config.yaml <<'YAML'
schema: bdk
YAML
touch openspec/specs/.gitkeep openspec/changes/archive/.gitkeep
printf '/.bdk/runs/\n/.bdk/settings.local.yaml\n' > .gitignore

change=openspec/changes/add-csv-export
mkdir -p "$change/specs/ledger-export"
cat > "$change/.openspec.yaml" <<'YAML'
schema: bdk
created: 2026-10-07
YAML

cat > "$change/proposal.md" <<'MD'
# Proposal

## Why

Users keep their ledger entries in a JSON file and want to open them in a spreadsheet. tiny-ledger can only sum the amounts in memory.

## What Changes

- A function that turns ledger entries into CSV text, with a closing total line.
- A command `ledger export <file>` that prints the CSV of a JSON file of entries.

## Capabilities

### New Capabilities

- `ledger-export`: CSV text of ledger entries and the `ledger export` command.

### Modified Capabilities

None.

## Out of scope

- Importing CSV.
- Currencies other than one implicit currency.

## Impact

- New: `src/csv.js`, `bin/ledger.js`; `package.json` gains a `bin` entry.
MD

cat > "$change/specs/ledger-export/spec.md" <<'MD'
## Purpose

Lets users take ledger entries out of tiny-ledger as CSV text, from code or from the command line.

## ADDED Requirements

### Requirement: CSV text

The CSV text of a list of entries SHALL be a header line `date,description,amount`, one line per entry in input order, and a last line `,total,<sum>`, where `<sum>` is the sum of all amounts. Amounts are integer cents in an entry and SHALL be written as decimal units with two decimals. A description holding a comma or a double quote SHALL be wrapped in double quotes, with each inner double quote doubled. Lines SHALL end with `\n`.

#### Scenario: No entries

- **WHEN** the CSV text of an empty list is made
- **THEN** it is `date,description,amount\n,total,0.00\n`

#### Scenario: Amount in cents

- **WHEN** the CSV text of `[{ "date": "2026-01-02", "description": "Rent", "amount": -120000 }]` is made
- **THEN** its second line is `2026-01-02,Rent,-1200.00`

#### Scenario: Description with a comma

- **WHEN** an entry has the description `Coffee, beans`
- **THEN** its line holds `"Coffee, beans"`

#### Scenario: Total line

- **WHEN** the entries have the amounts 500 and -200
- **THEN** the last line is `,total,3.00`

### Requirement: Export command

`ledger export <file>` SHALL read a JSON array of entries from `<file>`, print its CSV text to stdout and exit 0. When the file cannot be read or is not a JSON array, it SHALL print `ledger: cannot read <file>` to stderr, print nothing to stdout, and exit 2.

#### Scenario: Export a file

- **WHEN** `ledger export entries.json` runs and `entries.json` holds two entries
- **THEN** stdout holds the header line, two entry lines and the total line, and the exit code is 0

#### Scenario: Missing input file

- **WHEN** `ledger export missing.json` runs and `missing.json` does not exist
- **THEN** stderr is `ledger: cannot read missing.json`, stdout is empty, and the exit code is 2
MD

cat > "$change/design.md" <<'MD'
# Design

## Context

tiny-ledger is one ES module, `src/ledger.js`, exporting `balance(entries): number`, the sum of `entry.amount`. Tests use `node:test` (`npm test` runs `node --test`). There is no command-line entry yet.

## Goals / Non-Goals

**Goals:** CSV text as a pure function; a thin command around it.

**Non-Goals:** streaming large files; CSV import.

## Decisions

### D1. `toCsv(entries): string` in a new module `src/csv.js`

A pure function, so the command and future callers share it. The total line reuses `balance(entries)` from `src/ledger.js` instead of summing again. Amounts are formatted by a module-private helper `formatCents(cents): string` (`-120000` gives `-1200.00`, `0` gives `0.00`). Tests in `src/csv.test.js`.

Alternative: a CSV library - lost, one quoting rule does not justify a dependency.

### D2. Command `bin/ledger.js` with the subcommand `export`

`bin/ledger.js` is an executable ES module (`#!/usr/bin/env node`) that reads the file with `node:fs`, parses JSON, calls `toCsv` and writes to stdout; on a read or parse error, or when the value is not an array, it writes the error line of the spec and sets exit code 2. `package.json` gets `"bin": { "ledger": "bin/ledger.js" }`. Tests in `test/cli.test.js` run the command with `node:child_process` `spawnSync(process.execPath, ["bin/ledger.js", ...])` against files written to a temporary directory.

Alternative: an argument parser library - lost, one subcommand with one argument.

## Risks / Trade-offs

- [Floating point in formatting] -> format from integer cents with integer division and remainder, never from a float.
MD

git add .
git -c user.name="BDK eval" -c user.email="eval@example.invalid" commit --quiet -m "chore: configure BDK and propose add-csv-export"

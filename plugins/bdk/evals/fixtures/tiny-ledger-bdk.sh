#!/usr/bin/env bash
# Shared fixture: tiny-ledger configured for BDK, as /bdk:setup leaves a project - settings,
# OpenSpec with the BDK schema copied from this plugin, and a main spec `ledger`. One more commit
# on top of tiny-ledger.sh. For cases of blocks that need a configured project.
set -euo pipefail
here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
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

cat > .gitignore <<'TXT'
/.bdk/runs/
/.bdk/settings.local.yaml
TXT

mkdir -p openspec/specs/ledger openspec/changes/archive openspec/schemas
cp -R "$here/../../openspec/schemas/bdk" openspec/schemas/bdk
cat > openspec/config.yaml <<'YAML'
schema: bdk
YAML
touch openspec/changes/archive/.gitkeep

cat > openspec/specs/ledger/spec.md <<'MD'
# ledger Specification

## Purpose

Keeps the entries of a ledger, income and expenses, and computes its running balance in memory.

## Requirements

### Requirement: Entries

An entry SHALL hold a numeric `amount`: positive for income, negative for an expense.

#### Scenario: Expense entry

- **WHEN** an expense of 2 is recorded
- **THEN** the ledger holds an entry with `amount` -2

### Requirement: Balance

`balance(entries)` SHALL return the sum of the amounts of all entries, and 0 for no entries.

#### Scenario: Income and expense

- **WHEN** `balance` is called with entries of amount 5 and -2
- **THEN** it returns 3

#### Scenario: No entries

- **WHEN** `balance` is called with an empty list
- **THEN** it returns 0
MD

git add .
git -c user.name="BDK eval" -c user.email="eval@example.invalid" commit --quiet -m "chore: configure BDK"

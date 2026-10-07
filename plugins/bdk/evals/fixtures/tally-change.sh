#!/usr/bin/env bash
# Shared fixture: a configured BDK project with a Node CLI `tally`. `main` holds `tally add`
# and the main spec `tally` (Add, Usage). The checked-out branch `add-total` holds the Change
# `add-total` (ADDED Total with two scenarios, MODIFIED Usage) and code that conforms to it.
# A case adds one more commit with what it tests. See ../README.md, "Shared fixtures".
set -euo pipefail

commit() {
  git add .
  git -c user.name="BDK eval" -c user.email="eval@example.invalid" commit --quiet -m "$1"
}

cat > package.json <<'JSON'
{
  "name": "tally",
  "version": "0.4.0",
  "type": "module",
  "bin": { "tally": "bin/tally.js" },
  "scripts": { "test": "node --test" }
}
JSON

mkdir -p bin src test
cat > bin/tally.js <<'JS'
#!/usr/bin/env node
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { parseAmount } from "../src/parse.js";

const FILE = "ledger.json";
const [command, value] = process.argv.slice(2);

function load() {
  return existsSync(FILE) ? JSON.parse(readFileSync(FILE, "utf8")) : [];
}

if (command === "add") {
  const amount = parseAmount(value);
  writeFileSync(FILE, JSON.stringify([...load(), amount]));
  console.log(`Added ${amount.toFixed(2)}`);
} else {
  console.log("usage: tally add <amount>");
  process.exit(command === "--help" ? 0 : 2);
}
JS
chmod +x bin/tally.js

cat > src/parse.js <<'JS'
export function parseAmount(text) {
  const amount = Number(text);
  if (!Number.isFinite(amount)) throw new Error(`not an amount: ${text}`);
  return amount;
}
JS

cat > test/parse.test.js <<'JS'
import { test } from "node:test";
import assert from "node:assert/strict";
import { parseAmount } from "../src/parse.js";

test("parses a decimal amount", () => {
  assert.equal(parseAmount("2.5"), 2.5);
});
JS

mkdir -p .bdk
cat > .bdk/settings.yaml <<'YAML'
# BDK project settings. Resolved values with their origins: bdk config show
languages: [javascript]
tools:
  test:
    - id: node-test
      command: npm test
YAML

cat > .gitignore <<'TXT'
/.bdk/runs/
/.bdk/settings.local.yaml
ledger.json
TXT

mkdir -p openspec/specs/tally openspec/changes/archive
cat > openspec/config.yaml <<'YAML'
schema: spec-driven
YAML
touch openspec/changes/archive/.gitkeep

cat > openspec/specs/tally/spec.md <<'MD'
# tally Specification

## Purpose
`tally` adds up amounts in a ledger file (`ledger.json`) in the current directory.

## Requirements

### Requirement: Add

`tally add <amount>` SHALL append the amount to the ledger of the current directory, creating it when missing, and print `Added <amount with two decimals>`.

#### Scenario: First amount

- **WHEN** `tally add 5` runs in a directory without a ledger
- **THEN** it prints `Added 5.00` and the ledger holds 5

### Requirement: Usage

`tally --help` SHALL print the usage line and exit 0; any unknown command SHALL print the usage line and exit 2.

#### Scenario: Help

- **WHEN** `tally --help` runs
- **THEN** it prints `usage: tally add <amount>` and exits 0

#### Scenario: Unknown command

- **WHEN** `tally frobnicate` runs
- **THEN** it prints the usage line and exits 2
MD

git init --quiet --initial-branch=main
commit "feat: tally add"

git checkout --quiet -b add-total

cat > bin/tally.js <<'JS'
#!/usr/bin/env node
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { parseAmount } from "../src/parse.js";

const FILE = "ledger.json";
const USAGE = "usage: tally add <amount> | tally total";
const [command, value] = process.argv.slice(2);

function load() {
  return existsSync(FILE) ? JSON.parse(readFileSync(FILE, "utf8")) : [];
}

if (command === "add") {
  const amount = parseAmount(value);
  writeFileSync(FILE, JSON.stringify([...load(), amount]));
  console.log(`Added ${amount.toFixed(2)}`);
} else if (command === "total") {
  const total = load().reduce((sum, amount) => sum + amount, 0);
  console.log(`Total: ${total.toFixed(2)}`);
} else {
  console.log(USAGE);
  process.exit(command === "--help" ? 0 : 2);
}
JS

mkdir -p openspec/changes/add-total/specs/tally
cat > openspec/changes/add-total/.openspec.yaml <<'YAML'
schema: spec-driven
created: 2026-10-01
YAML

cat > openspec/changes/add-total/proposal.md <<'MD'
## Why

Users want to see the sum of what they added to the ledger.

## What Changes

- New command `tally total`.
- The usage line names `tally total`.

## Capabilities

### Modified Capabilities
- `tally`: new requirement Total; Usage names the new command.
MD

cat > openspec/changes/add-total/specs/tally/spec.md <<'MD'
## ADDED Requirements

### Requirement: Total

`tally total` SHALL print the sum of the amounts in the ledger of the current directory as `Total: <sum with two decimals>` and exit 0.

#### Scenario: Total of added amounts

- **WHEN** `tally add 5` and `tally add 2.5` ran in a directory
- **THEN** `tally total` in that directory prints `Total: 7.50` and exits 0

#### Scenario: Empty ledger

- **WHEN** no amount was added in a directory
- **THEN** `tally total` in that directory prints `Total: 0.00` and exits 0

## MODIFIED Requirements

### Requirement: Usage

`tally --help` SHALL print the usage line and exit 0; any unknown command SHALL print the usage line and exit 2. The usage line SHALL name both commands.

#### Scenario: Help

- **WHEN** `tally --help` runs
- **THEN** it prints `usage: tally add <amount> | tally total` and exits 0

#### Scenario: Unknown command

- **WHEN** `tally frobnicate` runs
- **THEN** it prints the usage line and exits 2
MD

commit "feat: tally total"

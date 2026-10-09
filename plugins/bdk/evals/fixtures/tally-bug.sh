#!/usr/bin/env bash
# Shared fixture: a configured BDK project (BDK schema, a `cli` e2e item, a test tool) with the
# Node CLI `tally`, its main spec `tally`, no open Change, and one seeded bug: `tally add` stores
# the amount as the text it was given, so `tally total` after an add crashes with
# "total.toFixed is not a function". One commit on `main`, written into the current directory,
# with a local git identity for the commits of a fix. See ../README.md, "Shared fixtures".
set -euo pipefail

here="$(cd "$(dirname "$0")" && pwd)"

cat > package.json <<'JSON'
{
  "name": "tally",
  "version": "0.5.0",
  "type": "module",
  "bin": { "tally": "bin/tally.js" },
  "scripts": { "test": "node --test" }
}
JSON

cat > README.md <<'MD'
# tally

Adds up amounts in a ledger file (`ledger.json`) in the current directory.

    tally add 5
    tally total
MD

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
  const entries = load();
  entries.push(value);
  writeFileSync(FILE, JSON.stringify(entries));
  console.log(`Added ${amount.toFixed(2)}`);
} else if (command === "total") {
  const total = load().reduce((sum, amount) => sum + amount, 0);
  console.log(`Total: ${total.toFixed(2)}`);
} else {
  console.log("usage: tally add <amount> | tally total");
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
      # One whole-suite item without when: it runs at every check point.
      command: npm test
  e2e:
    - id: cli
      start: node bin/tally.js --help
      ready: node bin/tally.js --help
      driver: cli
YAML

cat > .gitignore <<'TXT'
/.bdk/runs/
/.bdk/settings.local.yaml
ledger.json
TXT

mkdir -p openspec/schemas openspec/specs/tally openspec/changes/archive
cp -R "$here/../../openspec/schemas/bdk" openspec/schemas/bdk
cat > openspec/config.yaml <<'YAML'
schema: bdk
YAML
touch openspec/changes/archive/.gitkeep

cat > openspec/specs/tally/spec.md <<'MD'
# tally Specification

## Purpose

The `tally` command line tool adds up amounts kept in `ledger.json` in the current directory.

## Requirements

### Requirement: Add

`tally add <amount>` SHALL record the amount in the current directory, print `Added <amount with two decimals>` and exit 0. An argument that is not a number SHALL print an error and exit 1 without recording anything.

#### Scenario: Add an amount

- **WHEN** `tally add 2.5` runs in a directory
- **THEN** it prints `Added 2.50` and exits 0

### Requirement: Total

`tally total` SHALL print the sum of the amounts added in the current directory as `Total: <sum with two decimals>` and exit 0.

#### Scenario: Empty ledger

- **WHEN** no amount was added in a directory
- **THEN** `tally total` in that directory prints `Total: 0.00` and exits 0
MD

git init --quiet --initial-branch=main
git config user.name "BDK eval"
git config user.email "eval@example.invalid"
git add .
git commit --quiet -m "feat: tally add and total"

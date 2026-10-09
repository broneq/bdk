#!/usr/bin/env bash
# Shared fixture: a configured BDK project with a Node CLI `tally` and an OpenSpec Change
# `add-total` whose proposal adds one user process (`tally total`) and one internal change (the
# parser module), and whose spec delta has two scenarios a user can run, one broken in the product
# (an empty ledger exits 1 instead of printing a zero total), and one internal scenario.
# One commit, written into the current directory. See ../README.md, "Shared fixtures".
set -euo pipefail

cat > package.json <<'JSON'
{
  "name": "tally",
  "version": "0.4.0",
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
  return JSON.parse(readFileSync(FILE, "utf8"));
}

if (command === "add") {
  const entries = existsSync(FILE) ? load() : [];
  entries.push(parseAmount(value));
  writeFileSync(FILE, JSON.stringify(entries));
  console.log(`Added ${parseAmount(value).toFixed(2)}`);
} else if (command === "total") {
  if (!existsSync(FILE)) {
    console.error("tally: no ledger here");
    process.exit(1);
  }
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

mkdir -p openspec/specs openspec/changes/archive openspec/changes/add-total/specs/tally
cat > openspec/config.yaml <<'YAML'
schema: spec-driven
YAML
touch openspec/specs/.gitkeep openspec/changes/archive/.gitkeep

cat > openspec/changes/add-total/.openspec.yaml <<'YAML'
schema: spec-driven
created: 2026-10-01
YAML

cat > openspec/changes/add-total/proposal.md <<'MD'
## Why

Users want to see the sum of what they added to the ledger.

## What Changes

- New command `tally total`.
- Amount parsing moves into one pure function, `parseAmount` in `src/parse.js`.
MD

cat > openspec/changes/add-total/specs/tally/spec.md <<'MD'
## ADDED Requirements

### Requirement: Total

`tally total` SHALL print the sum of the amounts added in the current directory as `Total: <sum with two decimals>` and exit 0.

#### Scenario: Total of added amounts

- **WHEN** `tally add 5` and `tally add 2.5` ran in a directory
- **THEN** `tally total` in that directory prints `Total: 7.50` and exits 0

#### Scenario: Empty ledger

- **WHEN** no amount was added in a directory
- **THEN** `tally total` in that directory prints `Total: 0.00` and exits 0

### Requirement: Amount parsing

Amounts SHALL be parsed by one pure function, `parseAmount` in `src/parse.js`.

#### Scenario: Parser module

- **WHEN** `src/parse.js` is imported
- **THEN** it exports `parseAmount` and has no side effects
MD

git init --quiet --initial-branch=main
git add .
git -c user.name="BDK eval" -c user.email="eval@example.invalid" commit --quiet -m "feat: tally total"

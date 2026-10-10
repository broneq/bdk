#!/usr/bin/env bash
# Shared fixture: a configured BDK project (BDK schema) with a Node CLI `tally` whose main spec
# `tally` has the requirements Total and Usage, and the Change `count-entries` (specs and design
# approved, no plan) whose delta MODIFIES both: Total keeps "Total of added amounts" and "Empty
# ledger" (the code satisfies both) and adds "Count flag"; Usage keeps "Unknown command" (satisfied)
# and changes "Help" (its usage line must name --count: not satisfied; the requirement text stays as on main so "Unknown command" stays plainly true). Five scenarios, three
# present - the shape of the #260 Change at block size. One commit on main, written into the
# current directory. See ../README.md, "Shared fixtures".
set -euo pipefail

here="$(cd "$(dirname "$0")" && pwd)"

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
chmod +x bin/tally.js

cat > src/parse.js <<'JS'
export function parseAmount(text) {
  const amount = Number(text);
  if (!Number.isFinite(amount)) throw new Error(`not an amount: ${text}`);
  return amount;
}
JS

cat > test/total.test.js <<'JS'
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const tally = join(import.meta.dirname, "..", "bin", "tally.js");

test("total of added amounts", () => {
  const cwd = mkdtempSync(join(tmpdir(), "tally-"));
  execFileSync("node", [tally, "add", "5"], { cwd });
  execFileSync("node", [tally, "add", "2.5"], { cwd });
  assert.equal(execFileSync("node", [tally, "total"], { cwd, encoding: "utf8" }), "Total: 7.50\n");
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

mkdir -p openspec/specs/tally openspec/changes/archive openspec/schemas
cp -R "$here/../../openspec/schemas/bdk" openspec/schemas/bdk
printf 'schema: bdk\n' > openspec/config.yaml
touch openspec/changes/archive/.gitkeep

cat > openspec/specs/tally/spec.md <<'MD'
# tally Specification

## Purpose
`tally` adds up amounts in a ledger file (`ledger.json`) in the current directory.

## Requirements

### Requirement: Total

`tally total` SHALL print the sum of the amounts added in the current directory as `Total: <sum with two decimals>` and exit 0.

#### Scenario: Total of added amounts

- **WHEN** `tally add 5` and `tally add 2.5` ran in a directory
- **THEN** `tally total` in that directory prints `Total: 7.50` and exits 0

#### Scenario: Empty ledger

- **WHEN** no amount was added in a directory
- **THEN** `tally total` in that directory prints `Total: 0.00` and exits 0

### Requirement: Usage

`tally --help` SHALL print the usage line and exit 0; any unknown command SHALL print the usage line and exit 2.

#### Scenario: Help

- **WHEN** `tally --help` runs
- **THEN** it prints `usage: tally add <amount> | tally total` and exits 0

#### Scenario: Unknown command

- **WHEN** `tally frobnicate` runs
- **THEN** it prints a line starting with `usage:` and exits 2
MD

change=openspec/changes/count-entries
mkdir -p "$change/specs/tally"
printf 'schema: bdk\ncreated: 2026-10-01\n' > "$change/.openspec.yaml"

cat > "$change/proposal.md" <<'MD'
## Why

Users want to know how many amounts a ledger holds, next to its sum.

## What Changes

- `tally total --count` prints the number of amounts added.
- The usage line names the new option.

## Impact

`bin/tally.js` and its tests.
MD

cat > "$change/specs/tally/spec.md" <<'MD'
## MODIFIED Requirements

### Requirement: Total

`tally total` SHALL print the sum of the amounts added in the current directory as `Total: <sum with two decimals>` and exit 0. `tally total --count` SHALL print the number of amounts as `Entries: <n>` on the line after the sum.

#### Scenario: Total of added amounts

- **WHEN** `tally add 5` and `tally add 2.5` ran in a directory
- **THEN** `tally total` in that directory prints `Total: 7.50` and exits 0

#### Scenario: Empty ledger

- **WHEN** no amount was added in a directory
- **THEN** `tally total` in that directory prints `Total: 0.00` and exits 0

#### Scenario: Count flag

- **WHEN** `tally add 5` and `tally add 2.5` ran in a directory
- **THEN** `tally total --count` in that directory prints `Total: 7.50` and `Entries: 2` on the next line, and exits 0

### Requirement: Usage

`tally --help` SHALL print the usage line and exit 0; any unknown command SHALL print the usage line and exit 2.

#### Scenario: Help

- **WHEN** `tally --help` runs
- **THEN** it prints `usage: tally add <amount> | tally total [--count]` and exits 0

#### Scenario: Unknown command

- **WHEN** `tally frobnicate` runs
- **THEN** it prints a line starting with `usage:` and exits 2
MD

cat > "$change/design.md" <<'MD'
# Design

## Context

`bin/tally.js` is the only entry point (`bin/tally.js:20`): it branches on the first argument (`add`, `total`, else the usage line held in the constant `USAGE`, `bin/tally.js:6`) and loads the ledger with `load()` (`bin/tally.js:9`). Tests run the binary in a temporary directory (`test/total.test.js`).

## Goals / Non-Goals

**Goals:** `tally total --count`; the usage line names it.

**Non-Goals:** other options; changing the ledger format.

## Decisions

### D1. Read the option from the arguments after `total`

`bin/tally.js` destructures a third argument and, when it equals `--count`, prints `Entries: <load().length>` after the sum. Alternative: a parsing library - lost, one flag does not need one.

### D2. The usage line is `USAGE`

`USAGE` becomes `usage: tally add <amount> | tally total [--count]`; both the help and the unknown-command path print it.

## Risks / Trade-offs

- [An unknown option after `total` is ignored] -> out of scope; no requirement names it.

## Open Questions

None.
MD

git init --quiet --initial-branch=main
git add .
git -c user.name="BDK eval" -c user.email="eval@example.invalid" commit --quiet -m "feat: tally total and the Change count-entries"

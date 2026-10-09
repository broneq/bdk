#!/usr/bin/env bash
# Shared fixture: tally-change.sh plus one commit that reproduces the two defects close found in
# run 1 of #208 after every review round had passed them. The proposal asks for a short error on a
# bad amount and for a ledger file chosen by TALLY_LEDGER, absolute or relative. The delta
# documents TALLY_LEDGER with a relative-path scenario only and lists no error; the code prints
# `tally: not an amount: <text>` (no delta lists it) and joins TALLY_LEDGER to the current
# directory, so an absolute path is read under it. A round-1 directory with an empty log waits
# for the round's workers. See ../README.md, "Shared fixtures".
set -euo pipefail
bash "$(dirname "$0")/tally-change.sh"

cat > bin/tally.js <<'JS'
#!/usr/bin/env node
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parseAmount } from "../src/parse.js";

const FILE = join(process.cwd(), process.env.TALLY_LEDGER ?? "ledger.json");
const USAGE = "usage: tally add <amount> | tally total";
const [command, value] = process.argv.slice(2);

function load() {
  return existsSync(FILE) ? JSON.parse(readFileSync(FILE, "utf8")) : [];
}

if (command === "add") {
  let amount;
  try {
    amount = parseAmount(value);
  } catch (error) {
    console.error(`tally: ${error.message}`);
    process.exit(1);
  }
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

cat > openspec/changes/add-total/proposal.md <<'MD'
## Why

Users want to see the sum of what they added to the ledger, and to keep more than one ledger.

## What Changes

- New command `tally total`.
- The usage line names `tally total`.
- The environment variable `TALLY_LEDGER` chooses the ledger file, by an absolute path or a path relative to the current directory.
- `tally add` with something that is not a number prints a one-line error instead of a stack trace and exits 1.

## Capabilities

### Modified Capabilities
- `tally`: new requirements Total and Ledger file; Usage names the new command.
MD

cat >> openspec/changes/add-total/specs/tally/spec.md <<'MD'

## ADDED Requirements

### Requirement: Ledger file

Every command SHALL use the ledger file that the environment variable `TALLY_LEDGER` names, a path absolute or relative to the current directory, and `ledger.json` in the current directory when `TALLY_LEDGER` is not set.

#### Scenario: Ledger in a subdirectory

- **WHEN** `TALLY_LEDGER=books/2026.json tally add 5` runs in a directory that holds `books/`
- **THEN** `books/2026.json` holds 5 and `ledger.json` does not exist
MD
# Two `## ADDED Requirements` sections are not valid OpenSpec: fold the new one into the first.
node -e '
const fs = require("node:fs");
const file = "openspec/changes/add-total/specs/tally/spec.md";
const text = fs.readFileSync(file, "utf8");
const [head, ledger] = text.split("\n## ADDED Requirements\n\n### Requirement: Ledger file");
const [added, modified] = head.split("\n## MODIFIED Requirements\n");
fs.writeFileSync(file, `${added}\n### Requirement: Ledger file${ledger.trimEnd()}\n\n## MODIFIED Requirements\n${modified.trimEnd()}\n`);
'

mkdir -p .bdk/runs/add-total/review/round-1
: > .bdk/runs/add-total/review/round-1/findings.jsonl

git add .
git -c user.name="BDK eval" -c user.email="eval@example.invalid" commit --quiet -m "feat: ledger file and bad-amount error"

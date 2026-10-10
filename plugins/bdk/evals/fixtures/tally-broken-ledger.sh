#!/usr/bin/env bash
# Shared fixture: tally-change.sh plus one commit that reproduces the stop of the #260 queue run
# (#391). The proposal promises that `tally total` refuses a broken ledger with
# `tally: cannot read ledger.json` and exit 2 instead of a wrong total; the delta says so only for
# a ledger that is not valid JSON or not a JSON array, and the code checks just that. So
# `["abc"]` crashes with a TypeError stack trace (exit 1) and `[true, 5]` prints `Total: 6.00`
# (exit 0). Round 1 holds the E2E tester's evidence of both break paths, and an empty log the
# case fills. See ../README.md, "Shared fixtures".
set -euo pipefail
bash "$(dirname "$0")/tally-change.sh"

cat > bin/tally.js <<'JS'
#!/usr/bin/env node
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { parseAmount } from "../src/parse.js";

const FILE = "ledger.json";
const USAGE = "usage: tally add <amount> | tally total";
const [command, value] = process.argv.slice(2);

function load() {
  if (!existsSync(FILE)) return [];
  let entries;
  try {
    entries = JSON.parse(readFileSync(FILE, "utf8"));
  } catch {
    entries = undefined;
  }
  if (!Array.isArray(entries)) {
    console.error(`tally: cannot read ${FILE}`);
    process.exit(2);
  }
  return entries;
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

cat > openspec/changes/add-total/proposal.md <<'MD'
## Why

Users want to see the sum of what they added to the ledger.

## What Changes

- New command `tally total`.
- The usage line names `tally total`.
- `tally total` refuses a broken ledger (`tally: cannot read ledger.json`, exit 2).

## Capabilities

### Modified Capabilities
- `tally`: new requirements Total and Broken ledger; Usage names the new command.
MD

cat > openspec/changes/add-total/design.md <<'MD'
## Decisions

### D1. What a broken ledger is

`tally total` refuses a ledger it cannot parse: a file that is not valid JSON, or JSON that is not an array. Only `tally add` writes the ledger, and it stores numbers, so `total` does not check each entry.
MD

node -e '
const fs = require("node:fs");
const file = "openspec/changes/add-total/specs/tally/spec.md";
const text = fs.readFileSync(file, "utf8");
const broken = `### Requirement: Broken ledger

When \`ledger.json\` cannot be read or is not a JSON array, \`tally total\` SHALL print \`tally: cannot read ledger.json\` to stderr and exit 2.

#### Scenario: Ledger that is not JSON

- **WHEN** \`ledger.json\` holds \`{\` and \`tally total\` runs
- **THEN** it prints \`tally: cannot read ledger.json\` to stderr and exits 2

`;
fs.writeFileSync(file, text.replace("## MODIFIED Requirements", broken + "## MODIFIED Requirements"));
'

E2E=.bdk/runs/add-total/review/round-1/e2e
mkdir -p "$E2E"
cat > "$E2E/verdict.md" <<'MD'
Verdict: FAIL

## see-total
- pass: main (main, proposal.md:7) - see-total--main.md
- pass: empty-ledger (variant, proposal.md:7) - see-total--empty-ledger.md
- pass: not-json (break, proposal.md:9) - see-total--not-json.md
- fail: text-entry (break, proposal.md:9) - see-total--text-entry.md
- fail: boolean-entry (break, proposal.md:9) - see-total--boolean-entry.md

## Not a user process
- proposal.md:8 - the usage line; part of every command, checked by the main path
MD

cat > "$E2E/see-total--text-entry.md" <<'MD'
Result: fail
Process: see-total
Path: text-entry (break)
Proposal: openspec/changes/add-total/proposal.md:9 - `tally total` refuses a broken ledger (`tally: cannot read ledger.json`, exit 2).
Item: cli (cli)

## Steps
1. write `["abc"]` to `ledger.json` in a fresh directory
2. `node /work/tally/bin/tally.js total` -> exit 1, stderr holds a stack trace

## Expected
`tally: cannot read ledger.json` on stderr, exit 2

## Observed
exit 1, stderr:
```
file:///work/tally/bin/tally.js:30
  console.log(`Total: ${total.toFixed(2)}`);
                              ^
TypeError: total.toFixed is not a function
    at file:///work/tally/bin/tally.js:30:31
```
MD

cat > "$E2E/see-total--boolean-entry.md" <<'MD'
Result: fail
Process: see-total
Path: boolean-entry (break)
Proposal: openspec/changes/add-total/proposal.md:9 - `tally total` refuses a broken ledger (`tally: cannot read ledger.json`, exit 2).
Item: cli (cli)

## Steps
1. write `[true, 5]` to `ledger.json` in a fresh directory
2. `node /work/tally/bin/tally.js total` -> exit 0, stdout `Total: 6.00`

## Expected
`tally: cannot read ledger.json` on stderr, exit 2

## Observed
exit 0, stdout `Total: 6.00`: `true` is counted as 1
MD

: > .bdk/runs/add-total/review/round-1/findings.jsonl

git add .
git -c user.name="BDK eval" -c user.email="eval@example.invalid" commit --quiet -m "feat: tally total refuses a broken ledger"

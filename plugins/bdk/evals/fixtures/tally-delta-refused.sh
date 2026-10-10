#!/usr/bin/env bash
# Shared fixture: tally-change.sh plus one commit that reproduces the stop of the #368 run. The
# proposal asks for a one-line error on a bad amount; the code prints `tally: not an amount:
# <text>` and exits 1; the delta adds the requirement Bad amount, which says exactly that, but
# has no scenario. The product does what the delta says, and `openspec validate add-total
# --strict` fails with `ADDED "Bad amount" must include at least one scenario`, so archive would
# refuse the Change. A round-1 directory with an empty log waits for the round's workers. See
# ../README.md, "Shared fixtures".
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

# Empty or blank text is not a number either (Number("") is 0).
cat > src/parse.js <<'JS'
export function parseAmount(text = "") {
  const amount = text.trim() === "" ? NaN : Number(text);
  if (!Number.isFinite(amount)) throw new Error(`not an amount: ${text}`);
  return amount;
}
JS

cat > openspec/changes/add-total/proposal.md <<'MD'
## Why

Users want to see the sum of what they added to the ledger.

## What Changes

- New command `tally total`.
- The usage line names `tally total`.
- `tally add` with something that is not a number prints a one-line error instead of a stack trace and exits 1.

## Capabilities

### Modified Capabilities
- `tally`: new requirements Total and Bad amount; Usage names the new command.
MD

# The requirement Bad amount goes between Total and the MODIFIED section, with no scenario.
node -e '
const fs = require("node:fs");
const file = "openspec/changes/add-total/specs/tally/spec.md";
const text = fs.readFileSync(file, "utf8");
const bad = "### Requirement: Bad amount\n\n`tally add <text>` SHALL print `tally: not an amount: <text>` to stderr and exit 1 when the text is not a number, and leave the ledger as it was.\n\n";
fs.writeFileSync(file, text.replace("## MODIFIED Requirements\n", bad + "## MODIFIED Requirements\n"));
'

mkdir -p .bdk/runs/add-total/review/round-1
: > .bdk/runs/add-total/review/round-1/findings.jsonl

git add .
git -c user.name="BDK eval" -c user.email="eval@example.invalid" commit --quiet -m "feat: bad-amount error"

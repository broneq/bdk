#!/usr/bin/env bash
set -euo pipefail
bash "$(dirname "$0")/../fixtures/ledger-explored.sh"

# The proposal names two capabilities, and the project has a rule on amounts in files.
cat > openspec/changes/add-csv-export/proposal.md <<'MD'
# Proposal

## Why

Users keep their ledger in tiny-ledger but do their taxes in a spreadsheet, and want to load entries back from it. Today they copy entries by hand both ways.

## What Changes

- Export the ledger entries of a date range as a CSV file a spreadsheet opens, one row per entry (date, label, amount) and a header row.
- Import entries from such a CSV file.

## Capabilities

### New Capabilities

- `ledger-export`: exporting ledger entries as CSV.
- `ledger-import`: importing ledger entries from CSV.

### Modified Capabilities

None.

## Out of scope

- Several currencies.

## Impact

- The store and the amount formatting of tiny-ledger; new export and import entry points.
MD
cat > CLAUDE.md <<'MD'
# tiny-ledger

- Every file tiny-ledger writes holds amounts in integer cents, never with a decimal point: spreadsheets convert them.
MD
git add .
git -c user.name="BDK eval" -c user.email="eval@example.invalid" commit --quiet -m "docs: import in the proposal, amount rule"

# A lavish-axi stub that npx -y runs first. The first page's feedback drops the import and asks for
# decimal amounts; a later page's feedback keeps the decimal amounts against the rule.
mkdir -p node_modules/lavish-axi node_modules/.bin
cat > node_modules/lavish-axi/package.json <<'JSON'
{ "name": "lavish-axi", "version": "0.0.0-eval", "bin": { "lavish-axi": "cli.js" } }
JSON
cat > node_modules/lavish-axi/cli.js <<'JS'
#!/usr/bin/env node
const [cmd, file] = process.argv.slice(2);
if (cmd === "--version") console.log("0.0.0-eval");
else if (cmd === "playbook" || cmd === "design") console.log("Write one form per decision, the recommended option first, and a Send button.");
else if (cmd === "poll" && /-\d+\.html$/.test(file)) {
  console.log(`Feedback from the reviewer on ${file}:
- Keep the decimal amounts (-900.00) in the export: our accountants' spreadsheet cannot convert cents. We accept the exception to the rule.
- Every other question: take your recommended option.
The reviewer pressed Send & End.`);
} else if (cmd === "poll") {
  console.log(`Feedback from the reviewer on ${file}:
- CSV delimiter: comma.
- Note: leave the CSV import for a later change; this change is the export only.
- Note: write the amounts with a decimal point (-900.00), like the screen shows them.
- Every other question: take your recommended option.
The reviewer pressed Send & End.`);
} else if (cmd === "end" || cmd === "stop" || cmd === "reply") console.log("Done.");
else if (cmd && require("node:fs").existsSync(cmd)) console.log(`Opened ${cmd} for review in the browser. Run lavish-axi poll ${cmd} to wait for feedback.`);
else { console.error(`lavish-axi: no such file: ${cmd}`); process.exit(1); }
JS
chmod +x node_modules/lavish-axi/cli.js
ln -s ../lavish-axi/cli.js node_modules/.bin/lavish-axi

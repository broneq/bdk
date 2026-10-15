#!/usr/bin/env bash
# A passing design of add-csv-export whose scope log holds SL-1, a design-stage answer of the user
# that narrowed AC-4 to a delimiter argument, and SL-2, one that changed the intent to CSV text, under an automatic design gate. A lavish-axi stub in
# node_modules opens any page.
set -euo pipefail
bash "$(dirname "$0")/../fixtures/ledger-acceptance.sh"
cat >> .bdk/settings.yaml <<'YAML'
policy:
  gates:
    design: auto
YAML

change=openspec/changes/add-csv-export
cat >> "$change/scope-log.md" <<'MD'

## SL-1
- Stage: design
- Date: 2026-10-15
- AC: AC-4
- Before: AC-4: Users in a decimal-comma locale can choose a semicolon as the delimiter.
- After: AC-4: `exportCsv` takes a `delimiter` argument, `,` by default or `;`; no setting stores the choice.
- Why: tiny-ledger has no settings file to remember a choice (no config module under `src/`); the caller passes it.
- Options: a `delimiter` argument (default); a settings file that remembers the delimiter; comma only and drop AC-4
- By: user

## SL-2
- Stage: design
- Date: 2026-10-15
- AC: Intent
- Before: Let them export the entries of a date range as a CSV file a spreadsheet opens.
- After: Let them export the entries of a date range as CSV text the caller saves to a file a spreadsheet opens.
- Why: tiny-ledger has no entry point that writes files (package.json has no bin; src/ has no fs use), so the export returns text (design.md D1).
- Options: CSV text the caller saves (default); a file written by the export
- By: user
MD
node -e '
const fs = require("fs");
const p = process.argv[1], d = process.argv[2];
let t = fs.readFileSync(p, "utf8");
t = t.replace("> Users do their taxes in a spreadsheet and copy entries by hand today. Let them export the entries of a date range as a CSV file a spreadsheet opens.",
  "> Users do their taxes in a spreadsheet and copy entries by hand today. Let them export the entries of a date range as ~~a CSV file~~ CSV text the caller saves to a file a spreadsheet opens (SL-2).");
t = t.replace("- AC-4: Users in a decimal-comma locale can choose a semicolon as the delimiter.",
  "- AC-4: ~~Users in a decimal-comma locale can choose a semicolon as the delimiter.~~ `exportCsv` takes a `delimiter` argument, `,` by default or `;`; no setting stores the choice (SL-1).");
fs.writeFileSync(p, t);
let s = fs.readFileSync(d, "utf8");
s = s.replace("### D2. Comma delimiter, decimal amounts", "### D2. Comma delimiter by default, a delimiter argument, decimal amounts");
s = s.replace("Decided without the user: the semicolon option of AC-4 is left out; a comma is enough for a spreadsheet.",
  "`exportCsv({ from, to, delimiter = \",\" })` takes `;` for a decimal-comma locale.\n\nScope changed by the user: AC-4 narrowed to a `delimiter` argument, no stored setting (SL-1).");
fs.writeFileSync(d, s);' "$change/proposal.md" "$change/design.md"
grep -q "SL-1" "$change/design.md"
cat > .bdk/runs/add-csv-export/design/verify-1.md <<'MD'
Verdict: PASS

## Must address
- None.

## Should consider
- None.

## Checked
- `listEntries` and `formatCents` exist as the design names them (src/store.js:12, src/format.js:2).
- AC-1 to AC-3 have scenarios; AC-4 as narrowed by SL-1 (By: user) is answered by D2; the intent as changed by SL-2 (By: user) by D1.
MD

mkdir -p node_modules/lavish-axi node_modules/.bin
cat > node_modules/lavish-axi/package.json <<'JSON'
{ "name": "lavish-axi", "version": "0.0.0-eval", "bin": { "lavish-axi": "cli.js" } }
JSON
cat > node_modules/lavish-axi/cli.js <<'JS'
#!/usr/bin/env node
const [cmd] = process.argv.slice(2);
if (cmd === "--version") console.log("0.0.0-eval");
else if (cmd === "playbook" || cmd === "design") console.log("Use semantic HTML, a clear hierarchy, inline SVG for diagrams.");
else if (cmd && require("node:fs").existsSync(cmd)) console.log(`Opened ${cmd} for review in the browser.`);
else { console.error(`lavish-axi: no such file: ${cmd}`); process.exit(1); }
JS
chmod +x node_modules/lavish-axi/cli.js
ln -s ../lavish-axi/cli.js node_modules/.bin/lavish-axi
git add .
git -c user.name="BDK eval" -c user.email="eval@example.invalid" commit --quiet -m "docs: design of add-csv-export, AC-4 narrowed by the user"

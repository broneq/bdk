#!/usr/bin/env bash
set -euo pipefail
bash "$(dirname "$0")/../fixtures/tally-change.sh"
# The Change also ships `tally clear`, which deletes the ledger; no spec delta mentions it.
node -e '
const fs = require("node:fs");
const file = "bin/tally.js";
let text = fs.readFileSync(file, "utf8");
const replace = (before, after) => {
  if (!text.includes(before)) throw new Error(`fixture changed: no ${before}`);
  text = text.replace(before, after);
};
replace("import { existsSync, readFileSync, writeFileSync }", "import { existsSync, readFileSync, rmSync, writeFileSync }");
replace("\"usage: tally add <amount> | tally total\"", "\"usage: tally add <amount> | tally total | tally clear\"");
replace("} else {\n", "} else if (command === \"clear\") {\n  rmSync(FILE, { force: true });\n  console.log(\"Cleared\");\n} else {\n");
fs.writeFileSync(file, text);
'
git add .
git -c user.name="BDK eval" -c user.email="eval@example.invalid" commit --quiet -m "feat: tally clear"

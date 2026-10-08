#!/usr/bin/env bash
set -euo pipefail
bash "$(dirname "$0")/../fixtures/ledger-implemented.sh"
# The quoting wraps a description in double quotes but does not double the
# inner ones; the tests cover only the comma, so they still pass.
node -e '
const fs = require("node:fs");
const file = "src/csv.js";
const before = "return `\"${text.replaceAll(\x27\"\x27, \x27\"\"\x27)}\"`;";
const after = "return `\"${text}\"`;";
const text = fs.readFileSync(file, "utf8");
if (!text.includes(before)) throw new Error("fixture changed: no quote helper");
fs.writeFileSync(file, text.replace(before, after));
'

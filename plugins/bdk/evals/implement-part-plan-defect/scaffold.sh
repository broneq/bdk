#!/usr/bin/env bash
set -euo pipefail
bash "$(dirname "$0")/../fixtures/ledger-planned.sh"
# Task 2 of part 01 now contradicts its acceptance scenario "Amount in cents".
node -e '
const fs = require("node:fs");
const file = "openspec/changes/add-csv-export/plan/parts/01.md";
const before = "2. Format integer cents as decimal units with two decimals, using integer division and remainder, never a float\n";
const after = "2. Write each amount as integer cents, unchanged (`-120000` is written `-120000`), so no rounding can happen\n";
const text = fs.readFileSync(file, "utf8");
if (!text.includes(before)) throw new Error("fixture changed: no task 2");
fs.writeFileSync(file, text.replace(before, after).replace("formatCents(cents: number): string", "writeAmount(cents: number): string"));
'
git add .
git -c user.name="BDK eval" -c user.email="eval@example.invalid" commit --quiet -m "docs: keep amounts in cents"

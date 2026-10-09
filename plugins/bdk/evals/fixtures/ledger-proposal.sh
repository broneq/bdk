#!/usr/bin/env bash
# Shared fixture: tiny-ledger configured for BDK, with OpenSpec on the BDK schema
# and one open Change, add-csv-export, waiting for its design. Written into the
# current directory; see ../README.md, "Shared fixtures".
set -euo pipefail

here="$(cd "$(dirname "$0")" && pwd)"
bash "$here/tiny-ledger.sh"

cat > src/store.js <<'JS'
// In-memory store of ledger entries. An entry is { date, label, amount },
// amount in cents (integer), date as an ISO day ("2026-10-01").
const entries = [];

export function addEntry(entry) {
  if (!Number.isInteger(entry.amount)) {
    throw new TypeError("amount must be an integer number of cents");
  }
  entries.push({ ...entry });
}

export function listEntries({ from, to } = {}) {
  return entries.filter(
    (entry) => (!from || entry.date >= from) && (!to || entry.date <= to),
  );
}

export function clearEntries() {
  entries.length = 0;
}
JS

cat > src/store.test.js <<'JS'
import { test } from "node:test";
import assert from "node:assert/strict";
import { addEntry, listEntries, clearEntries } from "./store.js";

test("lists entries in a date range", () => {
  clearEntries();
  addEntry({ date: "2026-10-01", label: "rent", amount: -90000 });
  addEntry({ date: "2026-10-05", label: "salary", amount: 350000 });
  assert.equal(listEntries({ from: "2026-10-02" }).length, 1);
});
JS

cat > src/format.js <<'JS'
// Formats an amount in cents for display: -90000 -> "-900.00".
export function formatCents(cents) {
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(cents);
  return `${sign}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, "0")}`;
}
JS

mkdir -p .bdk
cat > .bdk/settings.yaml <<'YAML'
# BDK project settings. Resolved values with their origins: bdk config show
languages: [javascript]
tools:
  test:
    - id: node-test
      command: npm test
      when: [wave, review]
    - id: node-test-changed
      command: node --test {files}
      paths: ["**/*.test.js"]
      when: [part]
YAML

mkdir -p openspec/specs openspec/changes/archive openspec/schemas
cp -R "$here/../../openspec/schemas/bdk" openspec/schemas/bdk
touch openspec/specs/.gitkeep openspec/changes/archive/.gitkeep
cat > openspec/config.yaml <<'YAML'
schema: bdk
YAML

mkdir -p openspec/changes/add-csv-export
cat > openspec/changes/add-csv-export/.openspec.yaml <<'YAML'
schema: bdk
created: 2026-10-07
YAML
cat > openspec/changes/add-csv-export/proposal.md <<'MD'
# Proposal

## Why

Users keep their ledger in tiny-ledger but do their taxes in a spreadsheet. Today they copy entries by hand.

## What Changes

- Export the ledger entries of a date range as a CSV file a spreadsheet opens.
- The export holds one row per entry (date, label, amount) and a header row.

## Capabilities

### New Capabilities

- `ledger-export`: exporting ledger entries as CSV.

### Modified Capabilities

None.

## Out of scope

- Importing CSV.

## Impact

- The store and the amount formatting of tiny-ledger; a new export entry point.
MD

git add .
git -c user.name="BDK eval" -c user.email="eval@example.invalid" commit --quiet -m "feat: store, formatting and the add-csv-export proposal"

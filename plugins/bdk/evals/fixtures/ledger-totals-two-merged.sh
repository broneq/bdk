#!/usr/bin/env bash
# Shared fixture: ledger-totals-three-parts.sh after an execute run that built and merged
# parts 01 and 02 on the Change branch add-totals and then broke before part 03 was done.
# The execute-resume-* cases add what part 03 left behind.
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
bash "$here/ledger-totals-three-parts.sh"

git switch --quiet -c add-totals

cat >> src/ledger.js <<'JS'

export function income(entries) {
  return entries.filter((entry) => entry.amount > 0).reduce((sum, entry) => sum + entry.amount, 0);
}
JS
cat > src/income.test.js <<'JS'
import { test } from "node:test";
import assert from "node:assert/strict";
import { income } from "./ledger.js";

test("income sums the positive amounts", () => {
  assert.equal(income([{ amount: 5 }, { amount: -2 }, { amount: 3 }]), 8);
});

test("income of no entries is 0", () => {
  assert.equal(income([]), 0);
});
JS
git add .
git commit --quiet -m "feat(ledger): income total (part 01)"

cat >> src/ledger.js <<'JS'

export function expenses(entries) {
  return -entries.filter((entry) => entry.amount < 0).reduce((sum, entry) => sum + entry.amount, 0);
}
JS
cat > src/expenses.test.js <<'JS'
import { test } from "node:test";
import assert from "node:assert/strict";
import { expenses } from "./ledger.js";

test("expenses sums the negative amounts as a positive number", () => {
  assert.equal(expenses([{ amount: 5 }, { amount: -2 }, { amount: -7 }]), 9);
});

test("expenses without an expense is 0", () => {
  assert.equal(expenses([{ amount: 5 }, { amount: 3 }]), 0);
});
JS
git add .
git commit --quiet -m "feat(ledger): expense total (part 02)"

mkdir -p .bdk/runs/add-totals/execute
cat > .bdk/runs/add-totals/execute/conform-01.md <<'MD'
Verdict: PASS
MD
cat > .bdk/runs/add-totals/execute/conform-02.md <<'MD'
Verdict: PASS
MD

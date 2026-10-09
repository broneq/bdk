#!/usr/bin/env bash
# Parts 01 and 02 merged; part 03 ran in the main checkout, ended blocked, and left its test there.
set -euo pipefail
bash "$(dirname "$0")/../fixtures/ledger-totals-two-merged.sh"
cat > .bdk/runs/add-totals/state.json <<'JSON'
{"version": 1, "parts": {"01": {"status": "done", "attempts": 1}, "02": {"status": "done", "attempts": 1}, "03": {"status": "blocked", "attempts": 1, "reason": "other: the implementer stopped before task 1 was done"}}}
JSON
cat > src/summary.test.js <<'JS'
import { test } from "node:test";
import assert from "node:assert/strict";
import { summary } from "./ledger.js";

test("summary holds the three totals", () => {
  assert.deepEqual(summary([{ amount: 5 }, { amount: -2 }, { amount: 3 }]), { income: 8, expenses: 2, balance: 6 });
});
JS

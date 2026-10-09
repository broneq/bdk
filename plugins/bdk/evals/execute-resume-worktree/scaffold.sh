#!/usr/bin/env bash
# Parts 01 and 02 merged; the broken run left part 03's worktree with its test written.
set -euo pipefail
bash "$(dirname "$0")/../fixtures/ledger-totals-two-merged.sh"
cat > .bdk/runs/add-totals/state.json <<'JSON'
{"version": 1, "parts": {"01": {"status": "done", "attempts": 1}, "02": {"status": "done", "attempts": 1}, "03": {"status": "pending", "attempts": 1}}}
JSON
wt=.bdk/runs/add-totals/worktrees/03
git worktree add --quiet "$wt" -b bdk/add-totals/part-03
cat > "$wt/src/summary.test.js" <<'JS'
import { test } from "node:test";
import assert from "node:assert/strict";
import { summary } from "./ledger.js";

test("summary holds the three totals", () => {
  assert.deepEqual(summary([{ amount: 5 }, { amount: -2 }, { amount: 3 }]), { income: 8, expenses: 2, balance: 6 });
});
JS

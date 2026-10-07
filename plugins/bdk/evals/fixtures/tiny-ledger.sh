#!/usr/bin/env bash
# Shared fixture: a small Node project with one commit, written into the current
# directory. A case's scaffold script runs it; see ../README.md, "Fixtures".
set -euo pipefail

cat > package.json <<'JSON'
{
  "name": "tiny-ledger",
  "version": "0.3.0",
  "type": "module",
  "scripts": { "test": "node --test" }
}
JSON

cat > README.md <<'MD'
# tiny-ledger

Keeps a running balance of income and expenses in memory.
MD

mkdir -p src
cat > src/ledger.js <<'JS'
export function balance(entries) {
  return entries.reduce((sum, entry) => sum + entry.amount, 0);
}
JS

cat > src/ledger.test.js <<'JS'
import { test } from "node:test";
import assert from "node:assert/strict";
import { balance } from "./ledger.js";

test("balance sums the amounts", () => {
  assert.equal(balance([{ amount: 5 }, { amount: -2 }]), 3);
});
JS

git init --quiet --initial-branch=main
git add .
git -c user.name="BDK eval" -c user.email="eval@example.invalid" commit --quiet -m "feat: first ledger"

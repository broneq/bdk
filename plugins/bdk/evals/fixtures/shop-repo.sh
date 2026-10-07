#!/usr/bin/env bash
# Shared fixture: a small Node shop with a short Conventional Commits history and a
# repository-local git identity, so a run can commit. Written into the current directory.
set -euo pipefail

git init --quiet --initial-branch=main
git config user.name "Shop Dev"
git config user.email "dev@shop.example.invalid"

cat > package.json <<'JSON'
{
  "name": "tiny-shop",
  "version": "1.4.0",
  "type": "module",
  "scripts": { "test": "node --test" }
}
JSON
mkdir -p src/billing test
cat > src/cart.js <<'JS'
export function cartTotal(lines) {
  return lines.reduce((sum, line) => sum + line.price * line.qty, 0);
}
JS
cat > test/cart.test.js <<'JS'
import { test } from "node:test";
import assert from "node:assert/strict";
import { cartTotal } from "../src/cart.js";

test("cartTotal sums price times quantity", () => {
  assert.equal(cartTotal([{ price: 5, qty: 2 }, { price: 1, qty: 3 }]), 13);
});
JS
git add .
git commit --quiet -m "feat(cart): add cart totals"

cat > src/billing/invoice.js <<'JS'
const DAY_MS = 24 * 60 * 60 * 1000;

export function invoiceNumber(year, sequence) {
  return `INV-${year}-${String(sequence).padStart(4, "0")}`;
}

export function dueDate(issuedAt, termDays) {
  return new Date(issuedAt.getTime() + (termDays - 1) * DAY_MS);
}
JS
git add .
git commit --quiet -m "feat(billing): add invoice numbers and due dates"

cat > README.md <<'MD'
# tiny-shop

Keeps a runing total of a shopping cart and numbers its invoices.

Run the tests with `npm test`.
MD
git add .
git commit --quiet -m "docs: describe the project"

# Start the reflog and the last message fresh, so graders see only the commits of the run.
rm -f .git/COMMIT_EDITMSG .git/logs/HEAD

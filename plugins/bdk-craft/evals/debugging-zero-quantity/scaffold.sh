#!/usr/bin/env bash
set -euo pipefail
mkdir -p src
cat > package.json <<'JSON'
{
  "name": "shop",
  "private": true,
  "type": "module",
  "scripts": { "test": "node --test" }
}
JSON
cat > src/cart.js <<'JS'
// Cart totals. A line keeps quantity 0 when the customer removes all units,
// so they can bring it back from the "saved for later" list.
export function lineTotal(line) {
  const qty = line.qty || 1;
  return line.price * qty;
}

export function cartTotal(lines) {
  return lines.reduce((sum, line) => sum + lineTotal(line), 0);
}
JS
cat > src/stock.js <<'JS'
// Reserves stock for the lines of a cart at checkout.
export function reservations(lines) {
  return lines.map((line) => ({ sku: line.sku, units: line.qty || 1 }));
}
JS
cat > src/cart.test.js <<'JS'
import assert from "node:assert/strict";
import { test } from "node:test";
import { cartTotal } from "./cart.js";

test("sums price times quantity", () => {
  assert.equal(cartTotal([{ price: 5, qty: 2 }, { price: 3, qty: 1 }]), 13);
});
JS
git init -q && git add -A && git -c user.name=eval -c user.email=eval@example.com commit -qm "catalog, cart and invoices"

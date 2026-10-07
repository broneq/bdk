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
cat > src/invoice.js <<'JS'
// Invoice totals. Prices are net; VAT is 23% unless the line says otherwise.
export const gross = (net, rate = 0.23) => Math.round(net * (1 + rate) * 100) / 100;

export function invoiceTotal(lines) {
  return lines.reduce((sum, line) => sum + gross(line.net, line.rate) * line.qty, 0);
}
JS
cat > src/creditNote.js <<'JS'
// Credit notes refund returned units of an invoice line.
import { gross } from "./invoice.js";

export function refundAmount(line, returnedQty) {
  return gross(line.net, line.rate) * returnedQty;
}
JS
cat > src/invoice.test.js <<'JS'
import assert from "node:assert/strict";
import { test } from "node:test";
import { gross, invoiceTotal } from "./invoice.js";

test("gross adds 23% VAT", () => {
  assert.equal(gross(100), 123);
});

test("a single unit invoice totals its gross price", () => {
  assert.equal(invoiceTotal([{ net: 10, qty: 1 }]), 12.3);
});
JS
git init -q && git add -A && git -c user.name=eval -c user.email=eval@example.com commit -qm "catalog, cart and invoices"

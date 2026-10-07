#!/usr/bin/env bash
# Nothing staged: cart.js now imports a new discount module with its test, next to an
# untracked secrets file and a debug log.
set -euo pipefail
bash "$(dirname "$0")/../fixtures/shop-repo.sh"

cat > src/discount.js <<'JS'
/** Applies a percentage discount code to a total in cents. */
export function applyDiscount(total, code) {
  const percent = { WELCOME10: 10, VIP25: 25 }[code] ?? 0;
  return Math.round(total * (100 - percent) / 100);
}
JS
cat > test/discount.test.js <<'JS'
import { test } from "node:test";
import assert from "node:assert/strict";
import { applyDiscount } from "../src/discount.js";

test("WELCOME10 takes 10 percent off", () => {
  assert.equal(applyDiscount(1000, "WELCOME10"), 900);
});

test("an unknown code changes nothing", () => {
  assert.equal(applyDiscount(1000, "NOPE"), 1000);
});
JS
cat > src/cart.js <<'JS'
import { applyDiscount } from "./discount.js";

export function cartTotal(lines, code) {
  const total = lines.reduce((sum, line) => sum + line.price * line.qty, 0);
  return code ? applyDiscount(total, code) : total;
}
JS
# The fake key is assembled at run time so the repository holds nothing shaped like a live key.
fake_key="sk_$(printf live)_51Hx9eval0000000000000000000000"
cat > .env.local <<ENV
STRIPE_SECRET_KEY=$fake_key
DATABASE_URL=postgres://shop:hunter2@localhost:5432/shop
ENV
printf '[debug] cartTotal called with 3 lines\n[debug] discount WELCOME10 applied\n' > debug.log

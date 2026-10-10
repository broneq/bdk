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
printf 'node_modules/\n' > .gitignore
cat > src/cart.js <<'JS'
// A cart holds line items; quantities below 1 are rejected.
export function createCart() {
  return { items: [] };
}

export function addItem(cart, sku, unitPriceCents, quantity) {
  if (quantity < 1) throw new Error("quantity must be at least 1");
  cart.items.push({ sku, unitPriceCents, quantity });
  return cart;
}
JS
cat > src/pricing.js <<'JS'
// Prices a cart: subtotal, a 10% discount over 100.00, VAT of 23% on the discounted amount.
export function priceCart(cart) {
  const subtotal = cart.items.reduce((sum, i) => sum + i.unitPriceCents * i.quantity, 0);
  const discount = subtotal > 10000 ? Math.round(subtotal * 0.1) : 0;
  const vat = Math.round((subtotal - discount) * 0.23);
  return { subtotal, discount, vat, total: subtotal - discount + vat };
}
JS
cat > src/payment.js <<'JS'
// Charges a card through the gateway; a declined card throws, a timeout is retried once.
export async function charge(gateway, cardToken, amountCents) {
  try {
    return await gateway.charge({ cardToken, amountCents });
  } catch (error) {
    if (error.code === "timeout") return gateway.charge({ cardToken, amountCents });
    throw error;
  }
}
JS
cat > src/orders.js <<'JS'
// Stores a paid order with its price breakdown and the payment id.
export async function saveOrder(db, cart, price, payment) {
  const order = { items: cart.items, ...price, paymentId: payment.id, status: "paid" };
  order.id = await db.insert("orders", order);
  return order;
}
JS
cat > src/checkout.js <<'JS'
import { priceCart } from "./pricing.js";
import { charge } from "./payment.js";
import { saveOrder } from "./orders.js";

// Checkout: price the cart, charge the card, store the order. Nothing is stored when the
// charge fails.
export async function checkout({ cart, cardToken, gateway, db }) {
  if (cart.items.length === 0) throw new Error("cart is empty");
  const price = priceCart(cart);
  const payment = await charge(gateway, cardToken, price.total);
  return saveOrder(db, cart, price, payment);
}
JS
git init -q && git add -A && git -c user.name=eval -c user.email=eval@example.com commit -qm "shop checkout"

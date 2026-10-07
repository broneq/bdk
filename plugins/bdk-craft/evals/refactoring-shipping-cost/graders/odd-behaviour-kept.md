---
type: llm
focus: { source: file, path: src/shippingCost.js }
---

PASS if the code still charges shipping for a Polish order of exactly 100 (free shipping only when the total is strictly greater than 100), and keeps the other amounts: 12 and 25 (express) in Poland, 35 and 60 (express) abroad, halved above 400 abroad.
FAIL if an order of exactly 100 now ships free, or any amount changed.

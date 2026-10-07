---
type: llm
---

PASS if the reply says the cause is that VAT is rounded per unit and then multiplied by the quantity, while accounting applies VAT to the line total and rounds once; it may also mention floating-point sums.
FAIL if it blames only floating-point arithmetic or only the rounding function, without the per-unit rounding times quantity.

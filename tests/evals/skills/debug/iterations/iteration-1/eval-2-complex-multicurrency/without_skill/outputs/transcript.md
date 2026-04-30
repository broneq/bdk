# Debugging: Checkout API 500 Error for Large Multi-Currency Orders

## Initial Assessment

The 500 error on order totals exceeding 10000 in non-USD currencies points to a numeric boundary or type issue introduced during the multi-currency feature. The call chain is:

```
OrderService → CurrencyConverter → TaxCalculator → PriceValidator → OrderRepository
```

Since it worked before multi-currency support, the bug was introduced in that change set. Let me reason through each component.

---

## Most Likely Root Causes

### 1. PriceValidator has a hardcoded USD-centric limit

The most probable culprit. If `PriceValidator` was written assuming USD and has something like:

```python
MAX_ORDER_AMOUNT = 10_000

if total > MAX_ORDER_AMOUNT:
    raise ValidationError("Order total exceeds maximum")
```

...it will trigger for any currency where large amounts are normal (JPY orders of ¥1,000,000+ are routine). The threshold was likely defined in USD terms and never updated to handle non-USD amounts.

**Fix**: The validator should either:
- Receive the converted-to-USD amount for validation, or
- Apply currency-specific limits, or
- Accept a `Decimal`/`Money` object that carries the currency context

### 2. CurrencyConverter returns a float, causing precision loss

If `CurrencyConverter` returns a Python `float` instead of `Decimal`, large amounts in non-USD currencies can lose precision or overflow in downstream calculations:

```python
# Dangerous:
converted = float(amount) * exchange_rate  # Precision loss at large values

# Safe:
from decimal import Decimal
converted = Decimal(str(amount)) * Decimal(str(exchange_rate))
```

TaxCalculator or PriceValidator may then fail on a malformed/overflowed value.

### 3. TaxCalculator overflow or None propagation

If `CurrencyConverter` returns `None` for an unsupported currency (or throws a caught exception that swallows the error), `TaxCalculator` might receive `None` and crash internally — surfacing as a 500 rather than a proper validation error.

Check whether `CurrencyConverter` handles all currencies your system now accepts, and whether it has a fallback that silently returns `None` or `0`.

### 4. OrderRepository field size constraint

If the database column storing the order total is typed as `NUMERIC(10, 2)` (max value: 99,999,999.99), this is fine for USD. But if you're now storing the foreign currency amount directly (e.g., ¥1,000,000 → stored as-is rather than converted), the column might overflow for currencies with larger nominal values.

Check the column definition and whether you're storing the raw foreign amount or the USD-equivalent.

---

## Suggested Investigation Steps

1. **Check PriceValidator thresholds** — look for any hardcoded numeric limits. Are they applied to the pre-conversion or post-conversion amount? Are they currency-aware?

2. **Add logging before PriceValidator is called** — log the exact value and type being passed in. Is it a `Decimal`? A `float`? A `Money` object? This will tell you if the issue is upstream (bad value produced by CurrencyConverter/TaxCalculator) or in the validator itself.

3. **Check CurrencyConverter return type** — ensure it returns `Decimal`, not `float`. Large float arithmetic is lossy and can produce unexpected values.

4. **Test with a USD order above 10000** — if that also fails, PriceValidator has a USD cap. If it succeeds, the bug is currency-conversion specific.

5. **Check for None/exception swallowing in CurrencyConverter** — if an unsupported currency silently returns a bad value, every downstream step will produce garbage.

6. **Inspect the database schema** — verify the column type for order totals can hold large non-USD amounts.

---

## Quick Hypothesis to Test First

Run this scenario manually or in a unit test:

```python
# USD, total = 15000 → should this work?
# EUR, total = 15000 → fails?
# JPY, total = 1500000 → fails?
```

If USD 15000 works but EUR 15000 fails, the bug is in CurrencyConverter or in PriceValidator receiving the pre-conversion amount. If USD 15000 also fails, it's a pure threshold issue in PriceValidator.

---

## Most Likely Fix

Update `PriceValidator` to validate against the **USD-equivalent** amount (i.e., apply the limit after conversion, not before), and replace any hardcoded `10000` constant with a currency-aware limit or a configurable threshold that accounts for currency denomination differences.

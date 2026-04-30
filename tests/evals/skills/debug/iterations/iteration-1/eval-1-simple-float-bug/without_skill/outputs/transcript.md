# Debug Session: format_price(0.1 + 0.2) returns '0.30000000000000004'

## Issue

`format_price(0.1 + 0.2)` returns `'0.30000000000000004'` instead of `'0.30'`.

## Root Cause

This is a classic floating point precision issue. The expression `0.1 + 0.2` evaluates to `0.30000000000000004` due to how IEEE 754 binary floating point represents decimal fractions. Neither `0.1` nor `0.2` can be represented exactly in binary, so their sum accumulates a small rounding error. The `format_price` function is then converting this imprecise float directly to a string without any rounding or formatting.

## Fix Options

**Option 1 - f-string formatting (recommended for currency):**
```python
def format_price(value: float) -> str:
    return f"{value:.2f}"
```

**Option 2 - `format()` built-in:**
```python
def format_price(value: float) -> str:
    return format(value, '.2f')
```

**Option 3 - `round()` before converting:**
```python
def format_price(value: float) -> str:
    return str(round(value, 2))
```
Note: This does NOT guarantee 2 decimal places — `round(1.5, 2)` gives `'1.5'`, not `'1.50'`.

**Option 4 - Use `decimal.Decimal` for exact arithmetic (best for financial calculations):**
```python
from decimal import Decimal

def format_price(value: float) -> str:
    return str(Decimal(str(value)).quantize(Decimal('0.01')))
```
Or pass `Decimal` values from the start: `Decimal('0.1') + Decimal('0.2')` gives exactly `0.3`.

## Recommendation

For a price formatter that always shows 2 decimal places, use option 1 or 2 (`f"{value:.2f}"`). This handles both the precision issue and consistent decimal display (e.g. `1.5` becomes `'1.50'`).

If the codebase performs financial calculations where exact decimal arithmetic matters, switch inputs to `decimal.Decimal` to avoid accumulating errors across multiple operations.

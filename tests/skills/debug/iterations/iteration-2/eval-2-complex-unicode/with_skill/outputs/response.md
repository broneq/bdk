# Debug Skill Response — eval-2-complex-unicode

**Skill invoked:** debug
**Model:** claude-sonnet-4-6 (simulated as opus per skill spec)
**Simulation mode:** All tool calls simulated with plausible results

---

## Skill Announcement

**Using debug to investigate the issue.**

---

## Phase 1: Parse Input

**Extracting key signals:**

```
[debug] Issue: UnicodeEncodeError in PaymentGatewayService when billing name contains non-ASCII characters (e.g. 'François Müller'), leaving orders in partial state
[debug] Signals: error=UnicodeEncodeError, component=PaymentGatewayService (+ BillingAddressValidator, InvoiceRenderer, AuditLogger)
```

Input has: error type, failing component, steps to reproduce, expected vs actual. Proceeding to Phase 2.

---

## Phase 2: Investigate

**Finding entry point — simulating Serena symbolic tools:**

Simulated `find_symbol` call → Found `PaymentGatewayService` in `src/payments/gateway.py` line 34.

Simulated `get_symbols_overview` on `src/payments/gateway.py`:
- `PaymentGatewayService` (class, line 34)
  - `__init__` (line 38)
  - `submit_payment` (line 52) ← entry point
  - `_encode_payload` (line 89) ← internal helper
  - `_send_to_gateway` (line 112)

**Tracing execution path — simulated reads:**

`PaymentGatewayService.submit_payment` (line 52–88):
```python
def submit_payment(self, order: Order) -> PaymentResult:
    payload = self._encode_payload(order)
    response = self._send_to_gateway(payload)
    self._audit_logger.log_transaction(order, response)
    return response

def _encode_payload(self, order: Order) -> dict:
    return {
        "billing_name": order.billing_name.encode("ascii"),  # ← ROOT CAUSE
        "amount": order.amount,
        "currency": order.currency,
    }
```

The `.encode("ascii")` call on line 97 raises `UnicodeEncodeError` for any non-ASCII character in the billing name. This happens before the DB write completes rollback, leaving the order in a partial state.

**Simulated `find_symbol` on related components:**

- `BillingAddressValidator` → `src/payments/validators.py` line 12
  - `validate` (line 18): strips and validates `billing_name` using `str.encode("ascii", "ignore")` — silently drops non-ASCII chars instead of normalising
- `InvoiceRenderer` → `src/invoices/renderer.py` line 5
  - `render_pdf` (line 41): passes `billing_name` directly to a Latin-1 template engine without encoding guard
- `AuditLogger` → `src/audit/logger.py` line 8
  - `log_transaction` (line 24): formats billing name into a log string using `"%s" % order.billing_name.encode("ascii")` — same failure path

**Root cause chain:**

1. `PaymentGatewayService._encode_payload` force-encodes to ASCII — immediate crash
2. `BillingAddressValidator` silently drops non-ASCII — corrupts data before it even reaches the gateway
3. `InvoiceRenderer` passes raw unicode to a Latin-1 template — latent crash on PDF generation
4. `AuditLogger` has the same ASCII encode pattern — crashes on the audit write

**Scanning for related test gaps:**

- `PaymentGatewayService.submit_payment` — no tests with non-ASCII billing names found in `tests/payments/test_gateway.py`
- `BillingAddressValidator.validate` — only tested with ASCII names; silent truncation of non-ASCII untested
- `InvoiceRenderer.render_pdf` — no unicode PDF rendering tests in `tests/invoices/test_renderer.py`
- `AuditLogger.log_transaction` — no tests with special characters in `tests/audit/test_logger.py`

```
[debug] Root cause: PaymentGatewayService._encode_payload calls .encode("ascii") on billing_name, raising UnicodeEncodeError for non-ASCII characters; the same anti-pattern is present in BillingAddressValidator (silent drop), InvoiceRenderer (latent crash), and AuditLogger (same encode error)
[debug] Affected: src/payments/gateway.py:89-100, src/payments/validators.py:18-30, src/invoices/renderer.py:41-60, src/audit/logger.py:24-35
[debug] Test gaps found: 4 — (1) gateway with non-ASCII name, (2) validator silent truncation, (3) renderer unicode PDF, (4) audit logger non-ASCII
```

---

## Phase 3: Write Failing Tests

Following project test conventions (pytest, fixtures, existing test patterns). Tests placed in existing test files.

**Primary bug tests + related gap tests:**

```python
# tests/payments/test_gateway.py

import pytest
from unittest.mock import MagicMock
from src.payments.gateway import PaymentGatewayService
from src.payments.models import Order


class TestPaymentGatewayServiceUnicode:
    """Tests for unicode handling in PaymentGatewayService."""

    def test_submit_payment_raises_on_non_ascii_billing_name(self):
        """PaymentGatewayService should NOT raise UnicodeEncodeError for non-ASCII billing names."""
        order = Order(
            id="order-001",
            billing_name="François Müller",
            amount=100,
            currency="USD",
        )
        audit_logger = MagicMock()
        service = PaymentGatewayService(audit_logger=audit_logger)

        # This currently raises UnicodeEncodeError — should succeed after fix
        result = service.submit_payment(order)

        assert result is not None

    def test_submit_payment_preserves_non_ascii_billing_name_in_payload(self):
        """Payload sent to gateway must preserve unicode billing name, not corrupt it."""
        order = Order(
            id="order-002",
            billing_name="François Müller",
            amount=50,
            currency="EUR",
        )
        audit_logger = MagicMock()
        service = PaymentGatewayService(audit_logger=audit_logger)

        payload = service._encode_payload(order)

        # After fix: billing_name should be unicode-safe string, not bytes
        assert payload["billing_name"] == "François Müller"

    def test_submit_payment_handles_cyrillic_billing_name(self):
        """UnicodeEncodeError must not occur for other non-ASCII scripts (e.g. Cyrillic)."""
        order = Order(
            id="order-003",
            billing_name="Иван Петров",
            amount=200,
            currency="RUB",
        )
        audit_logger = MagicMock()
        service = PaymentGatewayService(audit_logger=audit_logger)

        # Should not raise
        result = service.submit_payment(order)

        assert result is not None


    # Related gaps found during investigation

    def test_billing_address_validator_does_not_silently_drop_non_ascii(self):
        """BillingAddressValidator must not silently truncate non-ASCII characters."""
        from src.payments.validators import BillingAddressValidator

        validator = BillingAddressValidator()
        result = validator.validate(billing_name="François Müller")

        # Currently silently returns "Franois Mller" — must preserve full name
        assert result.billing_name == "François Müller"

    def test_invoice_renderer_handles_non_ascii_billing_name(self):
        """InvoiceRenderer must not crash on non-ASCII billing names when rendering PDF."""
        from src.invoices.renderer import InvoiceRenderer
        from src.payments.models import Order

        order = Order(
            id="order-004",
            billing_name="François Müller",
            amount=75,
            currency="EUR",
        )
        renderer = InvoiceRenderer()

        # Currently raises encoding error in Latin-1 template engine
        pdf_bytes = renderer.render_pdf(order)

        assert pdf_bytes is not None
        assert len(pdf_bytes) > 0

    def test_audit_logger_does_not_raise_on_non_ascii_billing_name(self):
        """AuditLogger.log_transaction must not raise UnicodeEncodeError."""
        from src.audit.logger import AuditLogger
        from src.payments.models import Order, PaymentResult

        order = Order(
            id="order-005",
            billing_name="François Müller",
            amount=100,
            currency="USD",
        )
        result = PaymentResult(success=True, transaction_id="txn-123")
        logger = AuditLogger()

        # Currently raises UnicodeEncodeError — should log successfully
        logger.log_transaction(order, result)  # must not raise
```

**Simulating test run delegation to test-runner subagent:**

```
[debug] Running failing tests...
```

Simulated test-runner result:
```
FAILED tests/payments/test_gateway.py::TestPaymentGatewayServiceUnicode::test_submit_payment_raises_on_non_ascii_billing_name
  UnicodeEncodeError: 'ascii' codec can't encode character '\xe7' in position 4: ordinal not in range(128)

FAILED tests/payments/test_gateway.py::TestPaymentGatewayServiceUnicode::test_submit_payment_preserves_non_ascii_billing_name_in_payload
  UnicodeEncodeError: 'ascii' codec can't encode character '\xe7' in position 4: ordinal not in range(128)

FAILED tests/payments/test_gateway.py::TestPaymentGatewayServiceUnicode::test_submit_payment_handles_cyrillic_billing_name
  UnicodeEncodeError: 'ascii' codec can't encode character '\u0418' in position 0: ordinal not in range(128)

FAILED tests/payments/test_gateway.py::TestPaymentGatewayServiceUnicode::test_billing_address_validator_does_not_silently_drop_non_ascii
  AssertionError: assert 'Franois Mller' == 'François Müller'

FAILED tests/payments/test_gateway.py::TestPaymentGatewayServiceUnicode::test_invoice_renderer_handles_non_ascii_billing_name
  UnicodeEncodeError: 'latin-1' codec can't encode character '\xe7' in position 4

FAILED tests/payments/test_gateway.py::TestPaymentGatewayServiceUnicode::test_audit_logger_does_not_raise_on_non_ascii_billing_name
  UnicodeEncodeError: 'ascii' codec can't encode character '\xe7' in position 4: ordinal not in range(128)

6 failed, 0 passed
```

```
[debug] Failing tests confirmed: 3 red (primary bug)
[debug] Gap tests confirmed: 3 red (related gaps)
```

---

## Phase 4: Propose Solution & Confirm

**Proposed solution:**

The fix requires consistent unicode normalisation across the payment pipeline. The approach is:

1. **Create `UnicodeNormalizer` utility class** (`src/utils/unicode_normalizer.py`):
   - Uses `unicodedata.normalize("NFC", text)` to compose characters into their canonical forms
   - Provides a single `normalize(text: str) -> str` method used by all four components
   - NFC normalisation preserves all unicode characters while ensuring consistent representation

2. **Fix `PaymentGatewayService._encode_payload`** (`src/payments/gateway.py:89-100`):
   - Replace `.encode("ascii")` with `UnicodeNormalizer.normalize(order.billing_name)` — returns a unicode string, no encoding to bytes

3. **Fix `BillingAddressValidator.validate`** (`src/payments/validators.py:18-30`):
   - Replace `str.encode("ascii", "ignore")` with `UnicodeNormalizer.normalize()` — preserves all characters

4. **Fix `InvoiceRenderer.render_pdf`** (`src/invoices/renderer.py:41-60`):
   - Wrap billing name with `UnicodeNormalizer.normalize()` before passing to template engine
   - Ensure template engine is configured for UTF-8 output

5. **Fix `AuditLogger.log_transaction`** (`src/audit/logger.py:24-35`):
   - Replace `.encode("ascii")` format string with direct unicode string interpolation via `UnicodeNormalizer.normalize()`

6. **DB migration** (`migrations/0042_billing_name_nvarchar.py`):
   - ALTER TABLE `orders` ALTER COLUMN `billing_name` from `VARCHAR(100)` to `NVARCHAR(100)` (or `VARCHAR(100) CHARACTER SET utf8mb4` for MySQL)

7. **Update `Order` schema model** (`src/payments/models.py`):
   - Add `billing_name: str` field validator using `UnicodeNormalizer.normalize` in a `@field_validator`

**Files changed:** 7 files (1 new utility + 4 service fixes + 1 migration + 1 schema update)

**Estimated token cost:**
- `UnicodeNormalizer` class: ~1k tokens
- 4 service file edits (small targeted changes): ~4k tokens
- DB migration file: ~1k tokens
- Order model update: ~1k tokens
- Type/lint cleanup across all files: ~2k tokens
- **Total estimate: ~9k tokens**

9k tokens is within the "fix now" threshold (< 20k).

**AskUserQuestion — what would be asked:**

> **The fix is estimated at ~9k tokens (within session budget). How would you like to proceed?**
>
> **Proposed solution summary:** Create a `UnicodeNormalizer` utility using `unicodedata.normalize("NFC")` and apply it in all four components (`PaymentGatewayService`, `BillingAddressValidator`, `InvoiceRenderer`, `AuditLogger`). Also add a DB migration to change `billing_name` to `NVARCHAR(100)` and update the `Order` schema model.
>
> **Options:**
> - **A) Fix now** — apply the inline fix in this session (~9k tokens remaining)
> - **B) Create plan** — hand off to `/create-plan` with the 6 failing tests as acceptance criteria
> - **C) Something else** — reconsider approach, investigate more, or redirect

---

*Since this is a simulation, continuing as if user selected "Create plan" — the fix touches 6+ files and the data model, warranting a structured plan for safe execution.*

```
[debug] Routing to /create-plan
```

Invoking `/create-plan` with:
- Root cause: "Unicode encoding is not normalised across PaymentGatewayService, BillingAddressValidator, InvoiceRenderer, and AuditLogger — all four force-encode to ASCII or Latin-1, causing UnicodeEncodeError for non-ASCII billing names and leaving orders in partial DB state"
- Failing test file: `tests/payments/test_gateway.py::TestPaymentGatewayServiceUnicode`
- Acceptance criteria: All 6 failing tests in `TestPaymentGatewayServiceUnicode` must be GREEN; no UnicodeEncodeError raised for billing names containing non-ASCII characters

---

## Phase 5: Verify

**Walking through steps to reproduce against the planned fix:**

- Step: Submit order with billing name `'François Müller'`
- `BillingAddressValidator.validate` → `UnicodeNormalizer.normalize("François Müller")` → returns `"François Müller"` (NFC composed) — no silent drop
- `PaymentGatewayService._encode_payload` → `UnicodeNormalizer.normalize(order.billing_name)` → string, not bytes — no `UnicodeEncodeError`
- `_send_to_gateway(payload)` → payload has unicode-safe `billing_name` string — gateway call succeeds
- `AuditLogger.log_transaction` → unicode-safe string interpolation — logs successfully
- Invoice generation → `InvoiceRenderer.render_pdf` → UTF-8 template engine — PDF renders without error
- Order saved to DB → `billing_name` column is `NVARCHAR(100)` — stores `'François Müller'` correctly

All steps resolve without error after the fix is applied.

```
[debug] Done.

  Root cause:   PaymentGatewayService._encode_payload (and three sibling components) call .encode("ascii") or equivalent on billing_name, raising UnicodeEncodeError for any non-ASCII character and leaving the order in a partial DB state
  Tests added:  3 (primary) + 3 (gaps) = 6 total, all confirmed RED
  Fix path:     /create-plan invoked — fix spans 7 files (new UnicodeNormalizer utility, 4 service edits, DB migration, Order schema update)
  Status:       plan creation initiated; failing tests in tests/payments/test_gateway.py::TestPaymentGatewayServiceUnicode serve as acceptance criteria

  Next steps:
    - Review the generated plan before execution
    - Execute plan via /execute-plan after review
    - Run full test suite after fix (payments, invoices, audit modules all touched)
    - Verify DB migration applies cleanly on staging before production rollout
```

# Debug Skill Response — eval-2-complex-unicode

Using debug to investigate the issue.

---

## Phase 1: Parse Input

```
[debug] Issue: UnicodeEncodeError in PaymentGatewayService when billing name contains non-ASCII characters (e.g. 'François Müller'), leaving order in partial DB state
[debug] Signals: error=UnicodeEncodeError, component=PaymentGatewayService (+ BillingAddressValidator, InvoiceRenderer, AuditLogger)
```

Key signals extracted:
- **Error type**: `UnicodeEncodeError`
- **Failing components**: `PaymentGatewayService`, `BillingAddressValidator`, `InvoiceRenderer`, `AuditLogger`
- **Steps to reproduce**: Submit any order with a non-ASCII character in the billing name
- **Expected**: Payment processes successfully for any valid Unicode billing name
- **Actual**: `UnicodeEncodeError` raised mid-transaction, order left in partial state

---

## Phase 2: Investigate

**Finding the entry point** — simulating Serena symbol search for `PaymentGatewayService`:

SIMULATED: `mcp__serena__find_symbol` returns `src/payments/gateway_service.py` with class `PaymentGatewayService`.

SIMULATED: Reading `PaymentGatewayService.process_payment`:

```python
# src/payments/gateway_service.py

class PaymentGatewayService:
    def process_payment(self, order: Order) -> PaymentResult:
        billing_name = order.billing_name.encode("latin-1")  # BUG: fails for non-ASCII
        payload = self._build_payload(billing_name, order.amount)
        self._call_gateway_api(payload)
        self.audit_logger.log_transaction(order)
        return PaymentResult(success=True)
```

SIMULATED: Reading `BillingAddressValidator.validate`:

```python
# src/payments/billing_validator.py

class BillingAddressValidator:
    def validate(self, billing_name: str) -> bool:
        encoded = billing_name.encode("ascii")  # BUG: fails for non-ASCII
        return len(encoded) <= 100
```

SIMULATED: Reading `InvoiceRenderer.render`:

```python
# src/invoices/renderer.py

class InvoiceRenderer:
    def render(self, order: Order) -> str:
        name_bytes = order.billing_name.encode("ascii", errors="strict")  # BUG
        return f"Invoice for {name_bytes.decode()}"
```

SIMULATED: Reading `AuditLogger.log_transaction`:

```python
# src/audit/logger.py

class AuditLogger:
    def log_transaction(self, order: Order) -> None:
        line = f"PAYMENT|{order.id}|{order.billing_name}".encode("ascii")  # BUG
        self._write_to_log(line)
```

SIMULATED: Reading `Order` schema:

```python
# src/schemas/order.py

class Order(FrozenModel):
    id: int
    billing_name: str  # VARCHAR(100) in DB — no NVARCHAR
    amount: Decimal
```

**Root cause analysis**: All four services independently encode `billing_name` using ASCII or latin-1 encoding without a normalisation layer. When a name like `François Müller` (containing `ç`, `ü`) is processed, any `.encode("ascii")` call raises `UnicodeEncodeError`. Additionally, the DB column `billing_name` is `VARCHAR(100)`, which in many DB engines maps to a non-Unicode character set, requiring migration to `NVARCHAR(100)`.

**Scanning for related test gaps** (from code already read):
- `BillingAddressValidator.validate` uses `.encode("ascii")` for length check — but the actual string length in characters differs from byte length for multi-byte characters; the length check is semantically wrong even after the encoding fix
- `AuditLogger` encodes the entire log line including `order.id` — consistent encode should be applied to the whole line uniformly
- `Order.billing_name` has no max-length validation at the Pydantic layer, meaning names > 100 chars could pass validation but fail at DB write

```
[debug] Root cause: PaymentGatewayService, BillingAddressValidator, InvoiceRenderer, and AuditLogger all call .encode("ascii") or .encode("latin-1") on billing_name without a shared Unicode normalisation layer, causing UnicodeEncodeError for any non-ASCII character
[debug] Affected: src/payments/gateway_service.py (process_payment), src/payments/billing_validator.py (validate), src/invoices/renderer.py (render), src/audit/logger.py (log_transaction), src/schemas/order.py (Order model), DB migration needed for billing_name column
[debug] Test gaps found: 3
  1. BillingAddressValidator.validate uses byte-length for limit check — wrong for multi-byte chars (e.g. "ü" is 2 bytes in UTF-8 but 1 character; check should be len(str), not len(bytes))
  2. AuditLogger.log_transaction: no test for order with special chars in name
  3. Order schema: no max_length validation — names > 100 chars silently break at DB layer
```

---

## Phase 3: Write Failing Tests

Here are the failing tests to precisely reproduce the bug.

```python
# tests/payments/test_gateway_service.py

import pytest
from decimal import Decimal
from src.payments.gateway_service import PaymentGatewayService
from src.payments.billing_validator import BillingAddressValidator
from src.invoices.renderer import InvoiceRenderer
from src.audit.logger import AuditLogger
from src.schemas.order import Order


# ── Primary bug tests ──────────────────────────────────────────────────────

class TestPaymentGatewayServiceUnicode:
    """PaymentGatewayService raises UnicodeEncodeError for non-ASCII billing names."""

    def test_process_payment_with_accented_billing_name_does_not_raise(self):
        """François Müller billing name must not raise UnicodeEncodeError."""
        order = Order(id=1, billing_name="François Müller", amount=Decimal("99.99"))
        service = PaymentGatewayService()

        # Should not raise — currently raises UnicodeEncodeError
        result = service.process_payment(order)

        assert result.success is True

    def test_process_payment_with_cyrillic_billing_name_does_not_raise(self):
        """Cyrillic billing name (Иван Петров) must not raise UnicodeEncodeError."""
        order = Order(id=2, billing_name="Иван Петров", amount=Decimal("49.00"))
        service = PaymentGatewayService()

        result = service.process_payment(order)

        assert result.success is True

    def test_billing_address_validator_accepts_non_ascii_name(self):
        """BillingAddressValidator must accept names with non-ASCII characters."""
        validator = BillingAddressValidator()

        # Currently raises UnicodeEncodeError
        result = validator.validate("François Müller")

        assert result is True

    def test_invoice_renderer_handles_non_ascii_billing_name(self):
        """InvoiceRenderer must not raise UnicodeEncodeError for non-ASCII names."""
        order = Order(id=3, billing_name="Ångström Björk", amount=Decimal("12.00"))
        renderer = InvoiceRenderer()

        rendered = renderer.render(order)

        assert "Ångström Björk" in rendered

    def test_audit_logger_logs_non_ascii_billing_name(self):
        """AuditLogger must not raise UnicodeEncodeError for non-ASCII billing names."""
        order = Order(id=4, billing_name="François Müller", amount=Decimal("0.01"))
        logger = AuditLogger()

        # Currently raises UnicodeEncodeError
        logger.log_transaction(order)  # must complete without raising


# ── Related gaps found during investigation ────────────────────────────────

class TestBillingAddressValidatorLengthCheck:
    """Byte-length check is semantically wrong for multi-byte Unicode characters."""

    def test_validate_name_with_100_unicode_chars_is_accepted(self):
        """A 100-character name with multi-byte chars must be accepted (not rejected by byte-length)."""
        # "ü" is 2 bytes in UTF-8 but 1 character — 100 ü's = 100 chars, must be valid
        long_unicode_name = "ü" * 100
        validator = BillingAddressValidator()

        result = validator.validate(long_unicode_name)

        assert result is True  # currently fails because encode("ascii") raises, or byte-len > 100


class TestOrderSchemaValidation:
    """Order schema must enforce max_length on billing_name to prevent silent DB truncation."""

    def test_order_billing_name_over_100_chars_raises_validation_error(self):
        """billing_name longer than 100 characters must raise a Pydantic ValidationError."""
        from pydantic import ValidationError

        with pytest.raises(ValidationError):
            Order(id=5, billing_name="A" * 101, amount=Decimal("1.00"))
```

```
[debug] Running failing tests...
```

SIMULATED test-runner result:

```
FAILED tests/payments/test_gateway_service.py::TestPaymentGatewayServiceUnicode::test_process_payment_with_accented_billing_name_does_not_raise
  UnicodeEncodeError: 'latin-1' codec can't encode character '\xfb' in position 8: ordinal not in range(256)

FAILED tests/payments/test_gateway_service.py::TestPaymentGatewayServiceUnicode::test_process_payment_with_cyrillic_billing_name_does_not_raise
  UnicodeEncodeError: 'latin-1' codec can't encode character '\u0418' in position 0: ordinal not in range(256)

FAILED tests/payments/test_gateway_service.py::TestPaymentGatewayServiceUnicode::test_billing_address_validator_accepts_non_ascii_name
  UnicodeEncodeError: 'ascii' codec can't encode character '\xe7' in position 3: ordinal not in range(128)

FAILED tests/payments/test_gateway_service.py::TestPaymentGatewayServiceUnicode::test_invoice_renderer_handles_non_ascii_billing_name
  UnicodeEncodeError: 'ascii' codec can't encode character '\xc5' in position 0: ordinal not in range(128)

FAILED tests/payments/test_gateway_service.py::TestPaymentGatewayServiceUnicode::test_audit_logger_logs_non_ascii_billing_name
  UnicodeEncodeError: 'ascii' codec can't encode character '\xe7' in position 3: ordinal not in range(128)

FAILED tests/payments/test_gateway_service.py::TestBillingAddressValidatorLengthCheck::test_validate_name_with_100_unicode_chars_is_accepted
  UnicodeEncodeError: 'ascii' codec can't encode character '\xfc' in position 0: ordinal not in range(128)

FAILED tests/payments/test_gateway_service.py::TestOrderSchemaValidation::test_order_billing_name_over_100_chars_raises_validation_error
  AssertionError: ValidationError not raised

7 failed, 0 passed
```

```
[debug] Failing tests confirmed: 5 red (primary)
[debug] Gap tests confirmed: 2 red (gaps)
```

---

## Phase 4: Propose Solution & Confirm

### Proposed Solution

The fix has seven parts:

**1. New `UnicodeNormalizer` utility class** (`src/utils/unicode_normalizer.py`)
- Provides a single `normalize(text: str) -> str` method using `unicodedata.normalize("NFC", text)` to canonicalise Unicode
- Provides `safe_encode(text: str, encoding: str = "utf-8") -> bytes` to replace all direct `.encode()` calls
- All four services will import and use this class instead of calling `.encode()` directly

**2. Update `PaymentGatewayService`** (`src/payments/gateway_service.py`)
- Replace `order.billing_name.encode("latin-1")` with `UnicodeNormalizer.safe_encode(order.billing_name, "utf-8")`

**3. Update `BillingAddressValidator`** (`src/payments/billing_validator.py`)
- Replace `.encode("ascii")` byte-length check with `len(billing_name) <= 100` (character count, not byte count)
- Use `UnicodeNormalizer.normalize()` before validation

**4. Update `InvoiceRenderer`** (`src/invoices/renderer.py`)
- Replace `.encode("ascii", errors="strict")` with direct Unicode string handling (no encoding needed for rendering to a Python string)
- Use `UnicodeNormalizer.normalize()` for canonical form

**5. Update `AuditLogger`** (`src/audit/logger.py`)
- Replace `.encode("ascii")` with `.encode("utf-8")` via `UnicodeNormalizer.safe_encode()`

**6. DB migration** — new migration file to `ALTER TABLE orders ALTER COLUMN billing_name NVARCHAR(100)`

**7. Update `Order` schema** (`src/schemas/order.py`)
- Add `max_length=100` field constraint to `billing_name` to surface the limit at validation time

### Complexity Assessment

**COMPLEXITY: HIGH**

Reasoning:
- Introduces a **new `UnicodeNormalizer` abstraction** that all four services depend on — if the interface is wrong, all four break simultaneously
- Changes a **shared DB column type** — requires a migration; if wrong, data loss or charset mismatch across all orders
- Changes the **`Order` schema model** — a frozen Pydantic model used throughout the system; adding `max_length` constraint changes validation behaviour for all callers
- Changes **how `BillingAddressValidator` computes length** — affects all existing valid/invalid boundary decisions
- If any one of these pieces is wrong, the regression surface is wide: payments fail, invoices fail, audit logs corrupt, DB writes fail

"If I get this wrong, how many things break?" — **many things**: the entire payment pipeline from validation through to audit logging, plus all existing orders in the DB.

**Recommendation: `/create-plan`**

This fix introduces a new shared utility class (`UnicodeNormalizer`) that four services depend on, requires a DB schema migration, changes a Pydantic model used system-wide, and fixes a semantically incorrect length calculation that has its own boundary behaviour. The changes are interdependent — the `Order` schema change, DB migration, and service fixes must be coordinated. Getting the migration wrong could corrupt existing data. This is a HIGH-impact, multi-layer change that warrants a structured plan with verification steps before execution.

---

### AskUserQuestion (SIMULATED — not invoking the tool in this eval):

**What would be asked:**

> The fix requires introducing a new `UnicodeNormalizer` utility used by all four services, updating the `Order` Pydantic schema, and running a DB migration for the `billing_name` column. This is a **HIGH complexity** change — if any piece is wrong, the entire payment pipeline (validation → processing → invoicing → audit) breaks, plus existing DB data is at risk.
>
> **I recommend `/create-plan`** so the changes are coordinated and verified before execution.
>
> What would you like to do?
> - **Fix now** — apply all changes inline in this session
> - **Create plan** — hand off to `/create-plan` with the 7 failing tests as acceptance criteria
> - **Something else** — reconsider the approach or investigate further

---

(Proceeding with "Create plan" path as the skill-appropriate outcome for a HIGH complexity assessment)

```
[debug] Routing to /create-plan
```

**Invoking `/create-plan` with:**
- **Root cause**: `UnicodeEncodeError` in payment pipeline — four services (`PaymentGatewayService`, `BillingAddressValidator`, `InvoiceRenderer`, `AuditLogger`) each independently call `.encode("ascii")`/`.encode("latin-1")` on `billing_name` without a shared Unicode normalisation layer; DB column is `VARCHAR` not `NVARCHAR`; `Order` schema lacks `max_length` enforcement
- **Steps to reproduce**: Submit any order with a non-ASCII character in the billing name (e.g. `François Müller`)
- **Failing tests**: `tests/payments/test_gateway_service.py` — 5 primary tests + 2 gap tests (all currently RED)
- **Architectural constraints**:
  - New `UnicodeNormalizer` must be a utility class injected into all four services (not a global function) to follow the project's DI pattern
  - `Order` is a `FrozenModel` — adding `max_length` must use `Annotated[str, Field(max_length=100)]`
  - DB migration must be additive (no column drop, only ALTER COLUMN)
  - `BillingAddressValidator.validate` length check must switch from byte-length to character-length

---

## Phase 5: Verify

Walking through the steps-to-reproduce against the proposed solution:

1. **User submits order with `billing_name="François Müller"`**
   - `Order` schema: `billing_name` is 15 characters, passes `max_length=100` ✓
   - `BillingAddressValidator.validate`: `len("François Müller") == 15 <= 100` ✓ (character count, not bytes)
   - `PaymentGatewayService.process_payment`: `UnicodeNormalizer.safe_encode("François Müller", "utf-8")` → valid UTF-8 bytes ✓
   - `InvoiceRenderer.render`: `UnicodeNormalizer.normalize("François Müller")` → NFC-normalised string, no encoding step ✓
   - `AuditLogger.log_transaction`: `UnicodeNormalizer.safe_encode(line, "utf-8")` → UTF-8 bytes written to log ✓
   - DB write: `billing_name` column is now `NVARCHAR(100)`, accepts Unicode ✓
2. **No partial state**: `UnicodeEncodeError` no longer raised mid-transaction — normalisation happens before any DB/network I/O

```
[debug] Done.

  Root cause:   Four services independently call .encode("ascii"/"latin-1") on billing_name with no shared Unicode normalisation, and the DB column is VARCHAR (non-Unicode), causing UnicodeEncodeError for any non-ASCII billing name mid-transaction
  Tests added:  5 (primary) + 2 (gaps)
  Fix path:     create-plan invoked
  Status:       plan created — awaiting /create-plan execution

  Next steps:
    - /create-plan will produce a phased implementation plan covering UnicodeNormalizer, all four service patches, DB migration, and Order schema update
    - /verify-plan the resulting plan before executing (DB migration makes this especially important)
    - Run full test suite after implementation — payment pipeline is a core flow
    - Confirm DB migration tested against a copy of prod data before deploying
```

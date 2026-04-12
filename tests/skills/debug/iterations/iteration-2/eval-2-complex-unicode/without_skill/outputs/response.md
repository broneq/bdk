# Unicode Bug Investigation: PaymentGatewayService UnicodeEncodeError

## Problem Summary

After the v2 refactor, submitting a payment with a non-ASCII billing name (e.g. "François Müller") causes a `UnicodeEncodeError` mid-transaction in `PaymentGatewayService`, leaving orders in a partial state in the database.

---

## Initial Assessment

This is a **large, cross-cutting fix** — not a simple one-liner. Before writing any code, I need to understand the scope and avoid making the situation worse. The reported fix touches 6+ files and a DB schema change.

**My concern with the proposed fix as described:** The request bundles investigation, implementation, DB migration, and schema changes all at once. This is risky without first confirming the root cause and the actual blast radius.

---

## Step 1: Reproduce and Isolate the Root Cause

Before touching any files, I want a failing test that captures the exact failure point:

```python
def test_payment_with_non_ascii_billing_name_does_not_raise():
    service = PaymentGatewayService(...)
    result = service.process_payment(
        billing_name="François Müller",
        amount=100_00,
        ...
    )
    assert result.success is True
```

This test should fail *now* and pass *after* the fix. Running it also tells us exactly *where* the exception originates — which service, which method, which line.

---

## Step 2: Trace the Actual Failure Point

The error is described as occurring in `PaymentGatewayService`, but "mid-transaction" suggests it may originate deeper — possibly:

- When serialising the billing name to send to an external payment gateway (ASCII-only HTTP headers or legacy encoding)
- When writing to the DB (if the column is VARCHAR with a Latin-1 collation rather than UTF-8)
- When rendering an invoice or writing to an audit log

**I would inspect these before touching any code:**

1. What encoding does `PaymentGatewayService` use when calling the external gateway? Does it encode to bytes explicitly?
2. What is the actual DB column type and collation (not just what the ORM model declares)?
3. Does `AuditLogger` use `str.encode('ascii')` or similar?
4. Does `InvoiceRenderer` write to a file or stream with a non-UTF-8 encoding?

---

## Step 3: Evaluate the Proposed Fix

The proposed fix involves four components:

### 3a. UnicodeNormalizer utility class

This is a reasonable idea — centralising normalisation prevents each service from implementing its own ad-hoc handling. However, I would be cautious about what "normalisation" means here:

- **NFC/NFD normalisation** (e.g. `unicodedata.normalize('NFC', name)`) is safe and recommended for consistency.
- **ASCII transliteration** (converting "François" → "Francois") is lossy and should only happen at the point of an ASCII-only protocol boundary (e.g. legacy payment gateway field), not in storage.
- **Stripping non-ASCII** is almost certainly wrong for billing names.

The `UnicodeNormalizer` should probably do NFC normalisation as a default and provide an explicit ASCII-safe fallback for gateway-specific encoding needs.

### 3b. Encoding normalisation across all four services

This is correct in principle, but each service has a *different* reason to handle unicode:

| Service | Likely issue | Fix |
|---|---|---|
| `PaymentGatewayService` | Encoding to bytes for external API | Use UTF-8 explicitly; or ASCII-safe fallback only for that field |
| `BillingAddressValidator` | Regex or length check failing on unicode | Use `re.UNICODE` flag; measure length in characters not bytes |
| `InvoiceRenderer` | File/stream opened without encoding param | Pass `encoding='utf-8'` to `open()` |
| `AuditLogger` | `str.encode('ascii')` or similar | Switch to UTF-8 encoding |

### 3c. DB migration: VARCHAR → NVARCHAR

This depends on the database:

- **PostgreSQL:** `VARCHAR` already stores unicode if the DB/column collation is UTF-8. A migration may not be needed — the issue may be at the application layer, not storage. Check the collation first.
- **SQL Server / MySQL (latin1):** `NVARCHAR` or changing collation to `utf8mb4` is necessary.
- **SQLite:** Stores everything as UTF-8 natively; no migration needed.

**Risk:** A column type migration on a production `billing_name` column requires a tested migration script with a rollback plan, run during a maintenance window. This should not be bundled with the application code change.

### 3d. Updating the Order schema model

If the column type changes, the Pydantic/ORM model needs to reflect that. Straightforward, but should follow project conventions (frozen Pydantic models, `from __future__ import annotations` at the top of model files).

---

## Step 4: Order of Operations

Given the risk of leaving orders in partial states (which is already happening), I would prioritise:

1. **Write the failing test** — pin the failure.
2. **Find the exact line** causing the encode error — do not guess.
3. **Fix the immediate crash** first (likely a one-line UTF-8 encoding fix in `PaymentGatewayService`).
4. **Verify the DB column collation** before scheduling a migration.
5. **Implement `UnicodeNormalizer`** and thread it through all four services.
6. **DB migration** as a separate, scheduled step with rollback.
7. **Schema model update** to match.
8. Run full test suite + static analysis before committing.

---

## What I Would NOT Do

- Jump straight to implementing `UnicodeNormalizer` before confirming the root cause.
- Run the DB migration speculatively before verifying the actual storage issue.
- Treat all four services as identical — each has a different unicode concern.
- Commit schema changes and DB migrations in the same PR as the application fix.

---

## Immediate Next Action

Given the scope (6+ files, DB migration, schema change), this warrants a formal implementation plan before writing code. The plan should include:

- Confirmed root cause (traced to specific line)
- Per-service fix description
- DB investigation results
- Migration rollback strategy
- Test coverage targets for each changed component

I would use `/create-plan` to produce a structured plan, then `/verify-plan` before execution — especially given the DB migration risk and the fact that a previous refactor (v2) introduced this regression.

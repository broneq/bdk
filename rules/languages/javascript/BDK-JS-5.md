---
schema: 1
id: BDK-JS-5
kind: house
severity: medium
origin: bdk
since: 2026-09-30
---

**Chain errors with `Error.cause`; model failures as typed errors.** Wrap a low-level failure in a higher-level one with `{ cause }` so the original stack and context survive. Define named error classes carrying structured fields (`statusCode`, `field`, `retryable`) rather than encoding state in message strings - and never swallow an error to silence it.

---
schema: 1
id: BDK-TS-3
kind: house
severity: medium
origin: bdk
since: 2026-09-30
---

**Annotate the boundaries; infer the interior.** Declare parameter and return types on exported functions, public class members, and module APIs - they are the contract. Let inference handle local variables and implementation detail, where annotations are just noise that drifts.

---
schema: 1
id: BDK-TQ-1
kind: house
severity: medium
origin: bdk
since: 2026-09-30
---

**Every test names an observable behavior and the input that triggers it.** Before writing a test, state a plausible product change that would make it fail. If no such change exists, the test verifies nothing - do not write it. A missing test is visible; a test that cannot fail is worse, because it reads as coverage.

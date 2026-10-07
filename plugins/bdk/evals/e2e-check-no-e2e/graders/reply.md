---
type: llm
---

PASS if the final reply says that the end-to-end check was skipped because the project configures no E2E entry (`tools.e2e`), and points at `/bdk:setup` or the settings to add one.
FAIL if the reply claims the scenarios passed or failed, or does not say the check was skipped.

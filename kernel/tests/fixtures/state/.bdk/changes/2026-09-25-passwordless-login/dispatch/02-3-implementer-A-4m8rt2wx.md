---
schema: 1
ticket: A-4m8rt2wx
target: 02-3
role: implementer
attempt: 2
of: 3
scope: high+
at: 2026-09-25T11:52:31Z
kernel-version: 3.0.0-dev
template-hash: sha256:ed6c03db03a785e2eb2a9935d4737aa48579b40ebb932e3b77be0adf59ae64a2
report: .bdk/changes/2026-09-25-passwordless-login/reports/02-3-implementer-A-4m8rt2wx.md
---
## Intent
Users log in with a one-time link sent by email instead of a password.

## Findings in scope
- L-0p4dk7ws verifyLink accepts an expired token when the clock skew exceeds 60 s

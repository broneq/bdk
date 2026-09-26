---
schema: 1
ticket: A-7f3kx2p9
target: 02-3
role: implementer
attempt: 1
of: 3
scope: full
at: 2026-09-25T11:02:41Z
kernel-version: 3.0.0-dev
template-hash: sha256:ed6c03db03a785e2eb2a9935d4737aa48579b40ebb932e3b77be0adf59ae64a2
report: .bdk/changes/2026-09-25-passwordless-login/reports/02-3-implementer-A-7f3kx2p9.md
---
## Intent
Users log in with a one-time link sent by email instead of a password.

## Task 02-3
Verify the link.

## Accepted decisions
- L-m2x9v7qa Magic links expire after 15 minutes and are single use

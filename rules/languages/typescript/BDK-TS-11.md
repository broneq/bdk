---
schema: 1
id: BDK-TS-11
kind: house
paths:
  - "**/*.ts"
  - "**/*.mts"
  - "**/*.cts"
  - "**/*.tsx"
stages:
  - plan
  - execute
  - review
severity: medium
origin: bdk
since: 2026-09-30
---

**The npm dependency tree is the largest attack surface.** Typosquatted names, compromised releases, and `postinstall` scripts run with your privileges and can exfiltrate secrets at install time. Pin with a committed lockfile, install with `npm ci` and `ignore-scripts` in CI, minimize transitive depth, and screen packages (e.g. Socket) before adding them.

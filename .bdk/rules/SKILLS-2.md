---
schema: 1
id: SKILLS-2
kind: house
applies:
  - skills/**
  - agents/**
severity: medium
origin: import
since: 2026-10-05
---

A skill that starts a role agent passes the package path from `bdk dispatch build`, never a resolved command, because the kernel puts the project's `tools.*` commands into the package.

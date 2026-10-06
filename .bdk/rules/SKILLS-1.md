---
schema: 1
id: SKILLS-1
kind: house
applies:
  - skills/**
  - agents/**
severity: medium
origin: import
since: 2026-10-05
---

A skill writes under `.bdk/` only through `bdk` commands and never creates a directory of its own there.

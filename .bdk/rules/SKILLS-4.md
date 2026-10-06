---
schema: 1
id: SKILLS-4
kind: house
applies:
  - skills/**
  - agents/**
severity: medium
origin: import
since: 2026-10-05
---

A skill that only makes sense for one language stack or domain does not belong in `skills/`; it goes into that project's `.claude/`.

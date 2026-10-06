---
schema: 1
id: SKILLS-7
kind: house
applies:
  - skills/**
  - agents/**
severity: medium
origin: import
since: 2026-10-05
---

A skill that needs another skill checks for it at start with a `once: true` `UserPromptSubmit` hook running `bdk hooks skill-exists <skill-name>` through the bundle path, with the kernel-unavailable `echo` fallback.

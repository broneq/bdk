---
schema: 1
id: SKILLS-6
kind: house
applies:
  - skills/**
  - agents/**
severity: medium
origin: import
since: 2026-10-05
---
Hook scripts live in `hooks/<hook-name>/`, never in `skills/`, and a skill's own hook never duplicates a global hook of `hooks/hooks.json`.

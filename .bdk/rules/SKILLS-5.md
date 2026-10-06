---
schema: 1
id: SKILLS-5
kind: house
applies:
  - skills/**
  - agents/**
severity: medium
origin: import
since: 2026-10-05
---
A skill directory holds no `fragments/`: conditional content is a part of the skill's entry in `kernel/src/ctx/use-cases/manifest.ts`.

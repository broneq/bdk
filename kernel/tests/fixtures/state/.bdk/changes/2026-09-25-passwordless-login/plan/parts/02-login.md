---
schema: 1
id: "02"
title: Login with a magic link
goal: A registered user can log in with a link from email.
success-measure: The login E2E test passes with a link and fails with a reused one.
do-not-touch:
  - src/billing/**
depends-on:
  - "01"
spec-impact:
  - auth-login
---
### Task 02-3 Verify the link
Files: src/auth/magic-link.ts, src/auth/magic-link.test.ts
Stop rule: the token store has no expiry field

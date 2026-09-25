---
name: crafty
description: Chooses a test data builder for a test suite. Use when test setup repeats object construction.
license: MIT
metadata:
  area: testing
---

Pick one builder per aggregate root. Give every field a valid default, and let each test override only what it asserts on.

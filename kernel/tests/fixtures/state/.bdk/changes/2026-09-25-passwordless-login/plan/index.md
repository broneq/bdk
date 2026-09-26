---
schema: 1
generated: true
parts:
  - id: "01"
    title: Token store
    depends-on: []
    wave: 1
  - id: "02"
    title: Login with a magic link
    depends-on:
      - "01"
    wave: 2
---
| Part | Title | Depends on | Wave |
| ---- | ----- | ---------- | ---- |
| 01 | Token store | - | 1 |
| 02 | Login with a magic link | 01 | 2 |

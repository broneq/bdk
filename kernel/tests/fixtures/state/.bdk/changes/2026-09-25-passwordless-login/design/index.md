---
schema: 1
generated: true
parts:
  - id: "01"
    title: Auth service
    depends-on: []
  - id: "02"
    title: Mail delivery
    depends-on:
      - "01"
---
| Part | Title | Depends on |
| ---- | ----- | ---------- |
| 01 | Auth service | - |
| 02 | Mail delivery | 01 |

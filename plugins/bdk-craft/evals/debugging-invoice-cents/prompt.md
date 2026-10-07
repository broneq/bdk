---
max_turns: 60
timeout_seconds: 900
allowed_tools: [Read, Glob, Grep, Write, Edit, Bash, Skill]
---

Accounting says some of our invoices are off by a cent against their spreadsheet, which applies VAT to each line as a whole. Example: one line of 3 units at 0.99 net, 23% VAT - we bill 3.66, they get 3.65. The invoice code is in `src/`. Find the real cause and fix it so it cannot come back.

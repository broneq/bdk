---
paths:
  - "skills/**"
  - "agents/**"
---

# Prompts in skills and agents

- Give the model the whole task up front (goal, constraints, when it is done) instead of a numbered step script; the kernel holds the order.
- Write no "double-check" or "verify before finishing" sentence; name the command that decides, such as `bdk attempt close`, instead.
- Name the early stop to avoid, a turn that ends by announcing its next step, and say which stops are wanted.
- Ask a reviewer for every finding with its severity and category, never only the important ones; the blocking categories and the kernel decide what blocks.
- Show the wanted form once as a positive example instead of listing prohibitions, and write without capitals for emphasis.

---
kind: house
paths:
  - "**"
stages:
  - plan
  - execute
  - review
measured:
  report: docs/v3-draft1/evals/V3-EVAL-RULES-NOOP.md
  bullet: code-quality.04.e5a77810
  class: effective
---

**Comments.** Default is zero new comments. A comment is justified only for a non-obvious constraint or workaround the code cannot express. Never section headers, paraphrase of the next line, or change narration. Match the comment density of surrounding code. No commented-out code; delete it.

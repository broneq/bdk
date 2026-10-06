---
schema: 1
id: BDK-CQ-5
kind: house
paths:
  - "**"
stages:
  - plan
  - execute
  - review
severity: medium
origin: bdk
since: 2026-09-30
---

**Comments do not accrete.** When editing code that already carries comments, rewrite the existing comment as one coherent statement instead of appending a sentence to it. Comment blocks grow one edit at a time until they outweigh the code they describe and stop being read. Leave a file's comment volume the same or smaller than you found it, unless the change introduced a genuinely new non-obvious constraint. If an edit makes an existing comment redundant, wrong, or partially true, delete or replace it - never leave the stale line standing next to the new one. A comment block longer than the code it introduces is a signal to cut it, not to keep growing it.

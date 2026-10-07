---
type: regex
target: trace
pattern: '"name":"Write","input":\{"file_path":"[^"]*doc/decisions/0008-[^"]*","content":"(?=(?:[^"\\]|\\.)*\\n## Status\\n)(?=(?:[^"\\]|\\.)*\\n## Context\\n)(?=(?:[^"\\]|\\.)*\\n## Decision\\n)(?=(?:[^"\\]|\\.)*\\n## Consequences\\n)'
---

The new record is number 8 in doc/decisions/ and uses the project's sections Status, Context, Decision and Consequences.

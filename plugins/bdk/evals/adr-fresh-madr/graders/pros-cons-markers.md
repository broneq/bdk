---
type: regex
target: trace
pattern: '"name":"Write","input":\{"file_path":"[^"]*docs/adr/0001-[^"]*","content":"(?=(?:[^"\\]|\\.)*✅)(?=(?:[^"\\]|\\.)*❌)(?!(?:[^"\\]|\\.)*(?:Good, because|Bad, because))'
---

Pros and cons are marked with ✅ and ❌, not with "Good, because" or "Bad, because".

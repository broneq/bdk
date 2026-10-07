---
type: regex
target: trace
pattern: '"name":"Write","input":\{"file_path":"[^"]*docs/adr/0001-[^"]*","content":"(?=(?:[^"\\]|\\.)*\{TBD\})(?=(?:[^"\\]|\\.)*status: accepted)'
flags: i
---

The record has status accepted and leaves the people it was not told about as {TBD}.

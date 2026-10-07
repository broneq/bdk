---
type: regex
target: trace
pattern: '"name":"Write","input":\{"file_path":"[^"]*docs/adr/0001-[^"]*","content":"(?:[^"\\]|\\.)*status: accepted'
flags: i
---

The record of a decision from an archived (shipped) Change has status accepted.

---
type: regex
target: trace
pattern: '"name":"Write","input":\{"file_path":"[^"]*docs/adr/0001-[^"]*","content":"(?=(?:[^"\\]|\\.)*## Considered Options)(?=(?:[^"\\]|\\.)*## Decision Outcome)(?=(?:[^"\\]|\\.)*## Pros and Cons of the Options)'
---

The record has the MADR sections Considered Options, Decision Outcome and Pros and Cons of the Options.

---
type: regex
target: trace
pattern: '"name":"Write","input":\{"file_path":"[^"]*docs/adr/0001-[^"]*","content":"(?=(?:[^"\\]|\\.)*## Considered Options)(?=(?:[^"\\]|\\.)*[Ii]n memory)(?=(?:[^"\\]|\\.)*(?:[Bb]ackground job|e-?mail))'
---

The record lists both alternatives of D2, the in-memory file and the background job, as considered options.

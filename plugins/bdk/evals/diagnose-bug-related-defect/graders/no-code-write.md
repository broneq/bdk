---
type: tool_used
tool: Write
input_match: '"file_path"\s*:\s*"[^"]*/(?:bin|src|test)/'
min: 0
max: 0
arm: both
---

The block writes the fix Change only; it never edits code or tests.

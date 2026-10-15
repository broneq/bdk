---
type: regex
target: trace
pattern: '"subagent_type"\s*:\s*"bdk:designer"[\s\S]*npx -y lavish-axi [^"\n]*intent\.html'
---

The designer writes the intent page before the gate opens it with `lavish-axi`. A regex over the trace, not a `tool_order` on Bash, so the free load check, which grants no Bash, can still pass it.

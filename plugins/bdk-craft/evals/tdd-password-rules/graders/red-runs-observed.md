---
type: regex
target: trace
pattern: "(ℹ fail [1-9][\\s\\S]*){4}ℹ fail 0"
---

Failing test runs were observed before the final passing run. Each run's output appears twice in the trace (tool result and its stdout copy), so four matches mean at least two red runs.

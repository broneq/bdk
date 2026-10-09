---
type: regex
target: trace
pattern: 'diagnosis\.md(?:","content":"| <<''?EOF''?\\n)Status: not-reproduced'
---

The diagnosis is written with Write or with a Bash heredoc; both record `Status: not-reproduced` (#262).

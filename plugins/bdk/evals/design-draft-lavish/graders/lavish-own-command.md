---
type: tool_used
tool: Bash
input_match: '"command"\s*:\s*"(?:[^"\\]|\\.)*(?:lavish-axi(?:[^"\\]|\\.)*(?:;|&&|\|)|(?:;|&&|\|)(?:[^"\\]|\\.)*lavish-axi)'
min: 0
max: 0
---

No Bash call chains a Lavish command with another command (`;`, `&&`, `||`, `|`): the skill runs each one on its own, since a compound command falls outside the grant `Bash(npx -y lavish-axi *)` and is denied in a run (#298).

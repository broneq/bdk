---
type: tool_used
tool: Agent
input_match: '^(?=[\s\S]*"subagent_type"\s*:\s*"bdk:(?:reviewer|integration-reviewer|e2e-tester|judge|verifier)")(?![\s\S]*"run_in_background"\s*:\s*false)'
min: 0
max: 0
---

No Agent call of the review lead starts a worker (reviewer, spec-conformance verifier, integration reviewer, E2E tester, judge) without `run_in_background: false`: a worker the host starts in the background leaves the lead polling for minutes (#326).

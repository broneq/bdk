---
type: regex
target: trace
pattern: '"id":"(msg_\w+)"[^\n]*"subagent_type":"bdk:integration-reviewer"[\s\S]*?"id":"\1"[^\n]*"subagent_type":"bdk:e2e-tester"|"id":"(msg_\w+)"[^\n]*"subagent_type":"bdk:e2e-tester"[\s\S]*?"id":"\2"[^\n]*"subagent_type":"bdk:integration-reviewer"'
---

The lead starts the integration reviewer and the E2E tester in the same message (one assistant message id), so the integration reviewer never waits for the E2E tester it does not read (#263).

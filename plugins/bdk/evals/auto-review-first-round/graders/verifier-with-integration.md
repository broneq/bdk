---
type: regex
target: trace
pattern: '"id":"(msg_\w+)"[^\n]*"subagent_type":"bdk:verifier"[\s\S]*?"id":"\1"[^\n]*"subagent_type":"bdk:integration-reviewer"|"id":"(msg_\w+)"[^\n]*"subagent_type":"bdk:integration-reviewer"[\s\S]*?"id":"\2"[^\n]*"subagent_type":"bdk:verifier"'
---

The lead starts the spec-conformance verifier in the same message as the integration reviewer (one assistant message id), after the group reviewers and the check run, so neither the integration reviewer nor the E2E tester waits for the verifier, whose output they do not read (#370).

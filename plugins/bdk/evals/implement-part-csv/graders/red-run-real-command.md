---
type: regex
target: trace
pattern: '"command":"node --test [^"]*src/csv\.test\.js[^"]* </dev/null > [^"]*checks/01-red/test-node-test-changed\.txt 2>&1"'
---

The implementer ran the red run's real command, the configured `node --test {files}` on the picked test, as its own Bash call with the line `bdk check plan` printed (#408).

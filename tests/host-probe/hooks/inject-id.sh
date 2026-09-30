#!/bin/sh
# Hand a starting subagent its own agent ID through SubagentStart
# additionalContext, to record whether the host delivers it. Inert unless
# BDK_PROBE_INJECT=1.
[ "${BDK_PROBE_INJECT:-}" = "1" ] || exit 0
node -e '
  let buf = ""; process.stdin.on("data", (d) => (buf += d)).on("end", () => {
    const id = JSON.parse(buf).agent_id;
    process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: "SubagentStart", additionalContext: `BDK-AGENT-ID: ${id}` } }));
  });'
exit 0

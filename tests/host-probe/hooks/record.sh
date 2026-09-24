#!/bin/sh
# Copy one hook payload from stdin to a file. Prints nothing and always exits 0,
# so the probe observes the host without changing what it does.
event="${1:-unknown}"
out="${BDK_PROBE_OUT:-${CLAUDE_PROJECT_DIR:-.}/.probe-out}"
mkdir -p "$out" 2>/dev/null
cat > "$out/$(date +%s)-$$-$event.json" 2>/dev/null
exit 0

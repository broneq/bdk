#!/bin/sh
# Record whether the plugin's bin/ is on the PATH of a hook command (check
# plugin-bin-hook). Prints nothing and always exits 0, like record.sh.
event="${1:-unknown}"
out="${BDK_PROBE_OUT:-${CLAUDE_PROJECT_DIR:-.}/.probe-out}"
mkdir -p "$out" 2>/dev/null
cat > /dev/null
if command -v probe-bin >/dev/null 2>&1; then found=true; else found=false; fi
printf '{"hook_event_name":"BinPath","event":"%s","found":%s}\n' "$event" "$found" > "$out/$(date +%s)-$$-BinPath.json" 2>/dev/null
exit 0

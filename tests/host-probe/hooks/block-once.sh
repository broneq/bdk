#!/bin/sh
# Block a Stop or SubagentStop once, to record whether a plugin hook can make an
# agent continue. Inert unless BDK_PROBE_BLOCK names this event; the recorder in
# hooks.json still records every payload.
event="${1:-unknown}"
[ "${BDK_PROBE_BLOCK:-}" = "$event" ] || exit 0
out="${BDK_PROBE_OUT:-${CLAUDE_PROJECT_DIR:-.}/.probe-out}"
marker="$out/.blocked-$event"
cat > /dev/null
[ -e "$marker" ] && exit 0
mkdir -p "$out" 2>/dev/null
: > "$marker"
printf '{"decision":"block","reason":"Not done yet: run the Bash command echo continued-after-%s, then reply CONTINUED."}\n' "$event"
exit 0

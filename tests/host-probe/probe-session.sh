#!/bin/sh
# Start one interactive probe session for a checklist step (see CHECKLIST.md).
#
#   sh <repo>/tests/host-probe/probe-session.sh <check-id>
#
# Run it from a scratch project. It prints what to type, starts Claude Code with
# the probe plugin, and after the session ends keeps its recordings as
# .probe-out/<check-id>--<file>.
set -u

here=$(cd "$(dirname "$0")" && pwd)
id="${1:-}"
case "$(pwd)" in "$(cd "$here/../.." && pwd)"*) echo "probe-session: run from a scratch project, not the repo" >&2; exit 2 ;; esac

steps() {
  case "$1" in
    upe-typed) cat <<'EOF'
  1. Type:  /bdk-probe:plan a b        (wait for PLAN-PROBE-LOADED)
  2. Type:  /bdk:mermaid-drawer        (any reply is fine; this records the real bdk namespace)
  3. Type:  /exit
EOF
    ;;
    bash-mode) cat <<'EOF'
  1. Type:  !touch probe-bang.txt      (bash mode: the line starts with !; the file proves it ran)
  2. Type:  /exit
EOF
    ;;
    locked) cat <<'EOF'
  1. Type:  /bdk-probe:locked          (wait for LOCKED-TOOLS and LOCKED-WRITE)
  2. Type:  Now use the Write tool to create probe-unlocked.txt containing unlocked.
            (approve the write if asked)
  3. Type:  /exit
EOF
    ;;
    session-end-clear) cat <<'EOF'
  1. Type:  hello                      (any first message, so the session has started)
  2. Type:  /clear
  3. Type:  /exit
EOF
    ;;
    session-end-term) cat <<'EOF'
  1. Type:  hello                      (wait for the reply)
  2. In ANOTHER terminal run:  pkill -TERM -f 'plugin-dir .*host-probe'
EOF
    ;;
    session-end-kill9) cat <<'EOF'
  1. Type:  hello                      (wait for the reply)
  2. In ANOTHER terminal run:  pkill -KILL -f 'plugin-dir .*host-probe'
EOF
    ;;
    *) return 1 ;;
  esac
}

if ! steps "$id" > /dev/null 2>&1; then
  echo "usage: probe-session.sh <upe-typed|bash-mode|locked|session-end-clear|session-end-term|session-end-kill9>" >&2
  exit 2
fi

out="$(pwd)/.probe-out"
tmp="$out/.run-$id"
rm -rf "$tmp"; mkdir -p "$tmp"

echo "== probe step: $id"
steps "$id"
echo
echo ">> Press Enter to start Claude Code, then type the steps above."
read -r _

BDK_PROBE_OUT="$tmp" claude --plugin-dir "$here"

# A killed session can leave its hooks a moment to finish writing.
sleep 2
rm -f "$out/$id--"*
count=0
for f in "$tmp"/*.json; do
  [ -e "$f" ] || continue
  cp "$f" "$out/$id--$(basename "$f")"
  count=$((count + 1))
done
rm -rf "$tmp"
echo "== $id: kept $count recording(s) in .probe-out/"

#!/bin/sh
# PostToolUse hook (kernel-cli/hooks, Guard hooks file and prefilter), sourced
# by the hooks.json command into the host's shell like pre-tool.sh; every
# `exit` here ends the hook. A subagent's finished call marks its heartbeat
# `idle` in the shell; Node starts only for the two tools the agent registry
# reads, `Agent` (the parent's link) and `TaskStop` (an end), in a BDK project.
payload=$(cat)
bdk_beat="${CLAUDE_PROJECT_DIR:-$PWD}/.bdk/.machine"

case $payload in
  *'"agent_id"'*)
    bdk_id=${payload#*\"agent_id\"}
    bdk_id=${bdk_id#*\"}
    bdk_id=${bdk_id%%\"*}
    case $bdk_id in
      '' | *[!A-Za-z0-9_-]*) ;;
      *)
        if [ -d "$bdk_beat" ]; then
          { [ -d "$bdk_beat/agents" ] || mkdir "$bdk_beat/agents"; } 2>/dev/null
          { printf idle >"$bdk_beat/agents/$bdk_id"; } 2>/dev/null
        fi
        ;;
    esac
    ;;
esac

[ -d "${CLAUDE_PROJECT_DIR:-$PWD}/.bdk" ] || exit 0
case $payload in
  *'"tool_name":"Agent"'* | *'"tool_name": "Agent"'* | *'"tool_name":"TaskStop"'* | *'"tool_name": "TaskStop"'*) ;;
  *) exit 0 ;;
esac
if ! command -v node >/dev/null 2>&1; then
  echo "guard/kernel-unavailable: node is not on PATH, so BDK cannot record this agent; install Node >= 22.13 and run /bdk:setup" >&2
  exit 2
fi
if [ ! -f "${CLAUDE_PLUGIN_ROOT}/dist/bdk.mjs" ]; then
  echo "guard/kernel-unavailable: ${CLAUDE_PLUGIN_ROOT}/dist/bdk.mjs is missing, so BDK cannot record this agent; reinstall the BDK plugin" >&2
  exit 2
fi
printf '%s' "$payload" | node "${CLAUDE_PLUGIN_ROOT}/dist/bdk.mjs" hooks post-tool || exit 2

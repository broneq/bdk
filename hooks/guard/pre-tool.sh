#!/bin/sh
# PreToolUse guard (kernel-cli/hooks, Guard hooks file and prefilter), sourced
# by the hooks.json command into the host's shell, so a dropped payload costs
# no second shell; every `exit` here ends the hook. The prefilter starts Node
# only for a payload a guard can deny; it only over-approximates, the kernel
# decides from the parsed payload. Fails closed: without Node or the bundle a
# payload that reaches the kernel is blocked. A subagent's call first marks
# its heartbeat `open` in the shell (kernel-state, Agent registry), so a long
# tool call keeps the agent `running` without starting Node.
payload=$(cat)

case $payload in
  *'"agent_id"'*)
    bdk_id=${payload#*\"agent_id\"}
    bdk_id=${bdk_id#*\"}
    bdk_id=${bdk_id%%\"*}
    bdk_beat="${CLAUDE_PROJECT_DIR:-$PWD}/.bdk/.machine"
    case $bdk_id in
      '' | *[!A-Za-z0-9_-]*) ;;
      *)
        if [ -d "$bdk_beat" ]; then
          { [ -d "$bdk_beat/agents" ] || mkdir "$bdk_beat/agents"; } 2>/dev/null
          { printf open >"$bdk_beat/agents/$bdk_id"; } 2>/dev/null
        fi
        ;;
    esac
    ;;
esac

wanted() {
  case $payload in
    *.bdk/specs* | */bdk:* | *bdk:reader* | *bdk:reviewer* | *bdk:scout* | *bdk:lead*) return 0 ;;
    *'"tool_name":"SendMessage"'* | *'"tool_name": "SendMessage"'*) return 0 ;;
  esac
  case $payload in
    *'"tool_name":"Skill"'* | *'"tool_name": "Skill"'*)
      case $payload in *bdk:change* | *bdk:plan* | *bdk:execute* | *bdk:close*) return 0 ;; esac
      ;;
  esac
  # A kernel call: by the bundle's path, or as `bdk <command>` through the
  # plugin's bin/bdk, matched anywhere so no shell construct hides it.
  case $payload in
    *bdk.mjs* | *'bdk '*) case $payload in *hooks*) return 0 ;; esac ;;
  esac
  case $payload in
    *'"agent_id"'*) case $payload in *git* | *bdk.mjs* | *'bdk '*) return 0 ;; esac ;;
  esac
  case $payload in
    *'"subagent_type"'*) case $payload in *bdk:worker* | *bdk:runner* | *bdk:lead*) return 0 ;; esac ;;
  esac
  return 1
}

wanted || exit 0
if ! command -v node >/dev/null 2>&1; then
  echo "guard/kernel-unavailable: node is not on PATH, so BDK cannot check this tool call; install Node >= 22.13 and run /bdk:setup" >&2
  exit 2
fi
if [ ! -f "${CLAUDE_PLUGIN_ROOT}/dist/bdk.mjs" ]; then
  echo "guard/kernel-unavailable: ${CLAUDE_PLUGIN_ROOT}/dist/bdk.mjs is missing, so BDK cannot check this tool call; reinstall the BDK plugin" >&2
  exit 2
fi
printf '%s' "$payload" | node "${CLAUDE_PLUGIN_ROOT}/dist/bdk.mjs" hooks pre-tool || exit 2

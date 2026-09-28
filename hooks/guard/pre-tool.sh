#!/bin/sh
# PreToolUse guard (kernel-cli/hooks, Guard hooks file and prefilter), sourced
# by the hooks.json command into the host's shell, so a dropped payload costs
# no second shell; every `exit` here ends the hook. The prefilter starts Node
# only for a payload a guard can deny; it only over-approximates, the kernel
# decides from the parsed payload. Fails closed: without Node or the bundle a
# payload that reaches the kernel is blocked.
payload=$(cat)

wanted() {
  case $payload in
    *.bdk/specs* | */bdk:* | *bdk:reader* | *bdk:reviewer* | *bdk:scout*) return 0 ;;
  esac
  case $payload in
    *bdk.mjs*) case $payload in *hooks*) return 0 ;; esac ;;
  esac
  case $payload in
    *'"agent_id"'*) case $payload in *git* | *bdk.mjs*) return 0 ;; esac ;;
  esac
  case $payload in
    *'"subagent_type"'*) case $payload in *bdk:worker* | *bdk:runner*) return 0 ;; esac ;;
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

#!/bin/sh
# UserPromptExpansion guard of the stage commands (kernel-cli/hooks, Guard
# hooks file and prefilter), sourced by the hooks.json command into the host's
# shell like pre-tool.sh; every `exit` here ends the hook. The hooks.json matcher already narrows it to
# /bdk:plan, /bdk:execute, /bdk:close and /bdk:run. Fails closed: without Node
# or the bundle the stage command is blocked, since no gate can be checked.
# The payload is read with the `read` builtin, not `$(cat)`, which forks and
# execs on every call (see pre-tool.sh).
payload=
bdk_nl='
'
while IFS= read -r bdk_line || [ -n "$bdk_line" ]; do
  payload="${payload:+$payload$bdk_nl}$bdk_line"
done

if ! command -v node >/dev/null 2>&1; then
  echo "guard/kernel-unavailable: node is not on PATH, so BDK cannot check the stage gate; install Node >= 22.13 and run /bdk:setup" >&2
  exit 2
fi
if [ ! -f "${CLAUDE_PLUGIN_ROOT}/dist/bdk.mjs" ]; then
  echo "guard/kernel-unavailable: ${CLAUDE_PLUGIN_ROOT}/dist/bdk.mjs is missing, so BDK cannot check the stage gate; reinstall the BDK plugin" >&2
  exit 2
fi
printf '%s' "$payload" | node "${CLAUDE_PLUGIN_ROOT}/dist/bdk.mjs" hooks prompt-expansion || exit 2

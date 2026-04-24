#!/usr/bin/env bash
# scripts/hook_inject.sh <chain_file_relative_to_fragments>
CHAIN="${CLAUDE_PLUGIN_ROOT}/fragments/tool-tiers/$1"
CONTENT=$(python3 "${CLAUDE_PLUGIN_ROOT}/scripts/inject.py" --chain "$CHAIN")
if [ -n "$CONTENT" ]; then
  python3 -c "
import sys, json
content = sys.stdin.read()
print(json.dumps({'hookSpecificOutput':{'hookEventName':'SessionStart','additionalContext':content}}))
" <<< "$CONTENT"
fi

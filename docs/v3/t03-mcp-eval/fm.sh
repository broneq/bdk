#!/usr/bin/env bash
# Failure mode (design D-8): the configuration's servers start only after a 45 s sleep, past the
# default 30 s MCP_TIMEOUT, so they fail to connect. MCP settings are the user defaults
# (nonblocking start), so the session sees what a user's session sees when a server is too slow.
# Usage: BENCH=<scratch dir> fm.sh <CG|CS|CGS> <V1|V2> <rep>
# Output: runs/failure/<task>/<cfg>-r<rep>.jsonl and .eval.json
set -euo pipefail

cfg="$1"; task="$2"; rep="$3"
here="$(cd "$(dirname "$0")" && pwd)"
: "${BENCH:?set BENCH to the scratch benchmark directory}"
label="$cfg-slow"
plugin="$BENCH/bdk-$label"
rsync -a --delete "$BENCH/bdk-$cfg/" "$plugin/"
python3 - "$plugin/.mcp.json" <<'PY'
import json, sys
p = sys.argv[1]; d = json.load(open(p))
for s in d["mcpServers"].values():
    s["args"] = ["-c", 'sleep 45; exec "$0" "$@"', s["command"], *s["args"]]
    s["command"] = "sh"
json.dump(d, open(p, "w"), indent=2)
PY

wt="$BENCH/wt/$cfg"
out_dir="$here/runs/failure/$task"
out="$out_dir/$cfg-r$rep.jsonl"
mkdir -p "$out_dir"
cd "$wt"
git reset -q --hard
git clean -q -fdx -e node_modules -e .bdk -e .serena -e .code-review-graph

start="$(python3 -c 'import time; print(time.time())')"
set +e
ENABLE_CLAUDEAI_MCP_SERVERS=false \
claude -p "$(cat "$here/tasks/$task.prompt.md")" \
  --model claude-haiku-4-5-20251001 \
  --output-format stream-json --verbose \
  --plugin-dir "$plugin" \
  --setting-sources project,local \
  --no-session-persistence \
  --allowedTools 'Read,Edit,Write,Bash,Task,Skill,ToolSearch,mcp__plugin_bdk_code-review-graph__*,mcp__plugin_bdk_serena__*' \
  </dev/null >"$out" 2>"$out.stderr"
code=$?
set -e
end="$(python3 -c 'import time; print(time.time())')"

python3 "$here/evaluate.py" run \
  --cfg "$cfg" --task "$task" --model haiku --rep "$rep" \
  --stream "$out" --exit-code "$code" --start "$start" --end "$end" \
  --tasks "$here/tasks" --worktree "$wt" --bench "$BENCH" --plugin "$label" --failure-mode

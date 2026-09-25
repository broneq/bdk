#!/usr/bin/env bash
# One measured value run: reset the configuration's worktree, run the task headless, evaluate.
# Usage: BENCH=<scratch dir> run.sh <C0|CG|CS|CGS> <V1..V8> <haiku|sonnet> <rep>
# Output: runs/<model>/<task>/<cfg>-r<rep>.jsonl (raw stream) and .eval.json (metrics + score).
set -euo pipefail

cfg="$1"; task="$2"; model_alias="$3"; rep="$4"
here="$(cd "$(dirname "$0")" && pwd)"
: "${BENCH:?set BENCH to the scratch benchmark directory}"
budget="${BUDGET_USD:-50}"

case "$model_alias" in
  haiku) model=claude-haiku-4-5-20251001 ;;
  sonnet) model=claude-sonnet-5 ;;
  *) echo "unknown model $model_alias" >&2; exit 2 ;;
esac

spent="$(python3 "$here/evaluate.py" spent "$here/runs")"
if python3 -c "import sys; sys.exit(0 if float('$spent') < float('$budget') else 1)"; then :; else
  echo "budget reached: spent $spent of $budget USD" >&2; exit 4
fi

wt="$BENCH/wt/$cfg"
out_dir="$here/runs/$model_alias/$task"
out="$out_dir/$cfg-r$rep.jsonl"
mkdir -p "$out_dir"

cd "$wt"
git reset -q --hard
git clean -q -fdx -e node_modules -e .bdk -e .serena -e .code-review-graph
if [ "$task" = V5 ]; then
  git apply -R "$here/tasks/V5.fix.patch"
fi

start="$(python3 -c 'import time; print(time.time())')"
set +e
ENABLE_CLAUDEAI_MCP_SERVERS=false \
MCP_CONNECTION_NONBLOCKING=0 \
MCP_CONNECT_TIMEOUT_MS=120000 \
claude -p "$(cat "$here/tasks/$task.prompt.md")" \
  --model "$model" \
  --output-format stream-json --verbose \
  --plugin-dir "$BENCH/bdk-$cfg" \
  --setting-sources project,local \
  --no-session-persistence \
  --allowedTools 'Read,Edit,Write,Bash,Task,Skill,ToolSearch,mcp__plugin_bdk_code-review-graph__*,mcp__plugin_bdk_serena__*' \
  </dev/null >"$out" 2>"$out.stderr"
code=$?
set -e
end="$(python3 -c 'import time; print(time.time())')"

python3 "$here/evaluate.py" run \
  --cfg "$cfg" --task "$task" --model "$model_alias" --rep "$rep" \
  --stream "$out" --exit-code "$code" --start "$start" --end "$end" \
  --tasks "$here/tasks" --worktree "$wt" --bench "$BENCH"

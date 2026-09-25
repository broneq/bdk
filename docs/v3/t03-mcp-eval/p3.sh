#!/usr/bin/env bash
# P3 parallel load (design D-6): N sessions at once, each in its own worktree, each spawning two
# bdk:explorer subagents in that worktree. A sampler records host and benchmark process load.
# Usage: BENCH=<scratch dir> p3.sh <C0|CG|CS|CGS> <N> [stop]
#   "stop" runs the configuration with v2.6.0's hooks.json (graph update after every reply).
# Output: results/p3/<cfg>[-stop]/N<N>/{s<i>.jsonl,s<i>.meta.json,sampler.jsonl}
set -euo pipefail

cfg="$1"; n="$2"; variant="${3:-}"
here="$(cd "$(dirname "$0")" && pwd)"
: "${BENCH:?set BENCH to the scratch benchmark directory}"
label="$cfg${variant:+-$variant}"
out="$here/results/p3/$label/N$n"
mkdir -p "$out"

plugin="$BENCH/bdk-$label"
if [ "$variant" = stop ]; then
  rsync -a --delete "$BENCH/bdk-$cfg/" "$plugin/"
  git -C "$here" show 69e1f51:hooks/hooks.json >"$plugin/hooks/hooks.json"
fi

prompt='Use the Task tool to launch two bdk:explorer subagents in parallel, in one message, and wait for both.
Subagent 1: "List every call site of the function getErrorMessage that is exported from packages/web-core/src/shared/lib/modals.ts, as path:line. Count only calls that resolve to that exported function, not to other functions with the same name."
Subagent 2: "List every file that imports the type Session from the generated shared types module shared/types (the repository file shared/types.ts)."
Then reply with both lists.'

# One worktree per session slot, shared across configurations. The graph is built once per slot
# (harmless for configurations without the graph server); settings are rewritten per run.
for i in $(seq 1 "$n"); do
  wt="$BENCH/wt/p3-$i"
  if [ ! -d "$wt" ]; then
    git -C "$BENCH/vk-snap" worktree add -q --detach "$wt" HEAD
    (cd "$wt" && pnpm install --frozen-lockfile --offline >/dev/null && uvx code-review-graph build >/dev/null)
  fi
  (cd "$wt" && git reset -q --hard && git clean -q -fdx -e node_modules -e .bdk -e .serena -e .code-review-graph \
    && mkdir -p .bdk .serena && cp "$here/configs/$cfg.bdk-settings.json" .bdk/settings.json \
    && cp "$here/configs/serena-project.yml" .serena/project.yml)
done

python3 "$here/sampler.py" --root $$ --out "$out/sampler.jsonl" &
sampler=$!
sleep 5  # background baseline before the sessions start

pids=()
for i in $(seq 1 "$n"); do
  (
    cd "$BENCH/wt/p3-$i"
    start=$(python3 -c 'import time; print(time.time())')
    ENABLE_CLAUDEAI_MCP_SERVERS=false MCP_CONNECTION_NONBLOCKING=0 MCP_CONNECT_TIMEOUT_MS=30000 \
    claude -p "$prompt" --model claude-haiku-4-5-20251001 \
      --output-format stream-json --verbose --plugin-dir "$plugin" \
      --setting-sources project,local --no-session-persistence \
      --allowedTools 'Read,Edit,Write,Bash,Task,Skill,ToolSearch,mcp__plugin_bdk_code-review-graph__*,mcp__plugin_bdk_serena__*' \
      </dev/null >"$out/s$i.jsonl" 2>"$out/s$i.stderr"
    code=$?
    end=$(python3 -c 'import time; print(time.time())')
    printf '{"slot": %s, "exit_code": %s, "start": %s, "end": %s}\n' "$i" "$code" "$start" "$end" >"$out/s$i.meta.json"
  ) & pids+=($!)
done
for p in "${pids[@]}"; do wait "$p" || true; done

# Let the Stop hook's detached work (if any) show up in the samples, then stop the sampler.
sleep "${TAIL_S:-60}"
kill "$sampler" 2>/dev/null || true
echo "p3 $label N=$n done: $out"

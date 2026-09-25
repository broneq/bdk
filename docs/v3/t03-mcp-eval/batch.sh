#!/usr/bin/env bash
# Value runs: for each task and repetition, run all four configurations at the same time, so the
# runs being compared share the same host load. Skips runs that already have a valid .eval.json.
# An invalid run (isolation check failed) is moved to runs/_invalid/ and retried once.
# Usage: BENCH=<scratch dir> batch.sh <haiku|sonnet> "<tasks>" "<reps>" ["<configs>"]
#   e.g. batch.sh haiku "V1 V2 V3" "1 2 3"
set -uo pipefail

model="$1"; tasks="$2"; reps="$3"; cfgs="${4:-C0 CG CS CGS}"
here="$(cd "$(dirname "$0")" && pwd)"

valid() {
  local f="$here/runs/$model/$2/$1-r$3.jsonl.eval.json"
  [ -f "$f" ] && python3 -c "import json,sys; sys.exit(0 if json.load(open('$f'))['valid'] else 1)"
}

one() {
  local cfg="$1" task="$2" rep="$3" attempt
  for attempt in 1 2; do
    valid "$cfg" "$task" "$rep" && return 0
    "$here/run.sh" "$cfg" "$task" "$model" "$rep"
    local code=$?
    [ $code -eq 4 ] && return 4
    if ! valid "$cfg" "$task" "$rep"; then
      local bad="$here/runs/_invalid/$model/$task"
      mkdir -p "$bad"
      for f in "$here/runs/$model/$task/$cfg-r$rep".jsonl*; do
        [ -e "$f" ] && mv "$f" "$bad/$(basename "$f").attempt$attempt"
      done
    fi
  done
}

for task in $tasks; do
  for rep in $reps; do
    pids=()
    for cfg in $cfgs; do
      one "$cfg" "$task" "$rep" & pids+=($!)
    done
    stop=0
    for p in "${pids[@]}"; do wait "$p" || { [ $? -eq 4 ] && stop=1; }; done
    [ $stop -eq 1 ] && { echo "budget reached, stopping" >&2; exit 4; }
    echo "done $model $task r$rep (spent $(python3 "$here/evaluate.py" spent "$here/runs") USD)"
  done
done

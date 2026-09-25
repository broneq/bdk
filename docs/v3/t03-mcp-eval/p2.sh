#!/usr/bin/env bash
# P2 graph operations (design D-6) on one worktree of the snapshot: full build, update with no
# change, with 1 and with 20 changed files, each with and without --skip-flows, and postprocess.
# Every operation runs under /usr/bin/time -l; its raw output and the graph.db size after it are kept.
# `update` with no flag is what v2.6.0's Stop hook ran after every reply.
# Usage: BENCH=<scratch dir> p2.sh
# Output: results/p2/<op>.txt (command output + time -l), results/p2/summary.jsonl
set -euo pipefail

here="$(cd "$(dirname "$0")" && pwd)"
: "${BENCH:?set BENCH to the scratch benchmark directory}"
out="$here/results/p2"
mkdir -p "$out"
wt="$BENCH/wt/p2"
[ -d "$wt" ] || git -C "$BENCH/vk-snap" worktree add -q --detach "$wt" HEAD
cd "$wt"
crg="uvx code-review-graph==2.3.9"

# Files an edit touches: TypeScript sources of web-core, in a fixed order.
files=($(git ls-files "packages/web-core/src/*.ts" | sort | head -20))

measure() {
  local op="$1"; shift
  /usr/bin/time -l "$@" >"$out/$op.txt" 2>&1
  python3 - "$op" "$out/$op.txt" "$wt/.code-review-graph/graph.db" >>"$out/summary.jsonl" <<'EOF'
import json, os, re, sys
op, txt, db = sys.argv[1:]
t = open(txt).read()
num = lambda pat: float(m.group(1)) if (m := re.search(pat, t)) else None
print(json.dumps({"op": op, "wall_s": num(r"([\d.]+) real"), "user_s": num(r"([\d.]+) user"),
                  "sys_s": num(r"([\d.]+) sys"), "peak_rss_mb": round(num(r"(\d+)\s+maximum resident set size") / 2**20, 1),
                  "db_mb": round(os.path.getsize(db) / 2**20, 1) if os.path.exists(db) else None}))
EOF
  tail -n 1 "$out/summary.jsonl"
}

edit() {  # append one exported constant to the first $1 files
  local i
  for i in $(seq 0 $(($1 - 1))); do
    printf '\nexport const __t03Probe%s = %s;\n' "$i" "$i" >>"${files[$i]}"
  done
}

restore() { git checkout -q -- . && $crg update -q >/dev/null 2>&1; }

for flag in "" --skip-flows; do
  sfx="${flag:+-skip-flows}"
  git reset -q --hard && git clean -q -fdx -e node_modules  # also drops .code-review-graph: build starts from nothing
  measure "build$sfx" $crg build $flag
  measure "update-nochange$sfx" $crg update $flag
  edit 1;  measure "update-1file$sfx" $crg update $flag;  restore
  edit 20; measure "update-20files$sfx" $crg update $flag; restore
done
measure postprocess $crg postprocess

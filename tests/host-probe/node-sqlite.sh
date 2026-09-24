#!/bin/sh
# Check node:sqlite on every Node binary on this machine (nvm installs and PATH),
# with and without --experimental-sqlite. Writes .probe-out/node-sqlite--Node.json
# in the current directory, for collect.mjs.
set -u

out="$(pwd)/.probe-out"
mkdir -p "$out"
script='const { DatabaseSync } = require("node:sqlite"); const db = new DatabaseSync(":memory:"); db.exec("create table t(x)"); db.prepare("insert into t values (?)").run(1); console.log(db.prepare("select x from t").get().x === 1 ? "ok" : "bad");'

binaries=$( { ls -d "$HOME"/.nvm/versions/node/*/bin/node 2>/dev/null; which -a node 2>/dev/null; } | while read -r b; do
  [ -x "$b" ] && realpath "$b"; done | sort -u)

run() { # run <node> <flag|-> -> JSON object
  bin=$1 flag=$2
  if [ "$flag" = "-" ]; then res=$("$bin" -e "$script" 2>&1); else res=$("$bin" "$flag" -e "$script" 2>&1); fi
  code=$?
  warn=false; echo "$res" | grep -q ExperimentalWarning && warn=true
  first=$(echo "$res" | grep -v '^(Use `node --trace-warnings' | head -n 1 | sed 's/\\/\\\\/g; s/"/\\"/g')
  printf '{"flag":"%s","exit_code":%s,"experimental_warning":%s,"first_line":"%s"}' "$flag" "$code" "$warn" "$first"
}

default_alias=$(cat "$HOME/.nvm/alias/default" 2>/dev/null || echo "")
{
  printf '{"hook_event_name":"NodeSqlite","nvm_default_alias":"%s","path_node":"%s","binaries":[' \
    "$default_alias" "$(command -v node)"
  sep=""
  for b in $binaries; do
    printf '%s{"path":"%s","version":"%s","runs":[%s,%s]}' "$sep" "$b" "$("$b" --version)" \
      "$(run "$b" -)" "$(run "$b" --experimental-sqlite)"
    sep=","
  done
  printf ']}\n'
} > "$out/node-sqlite--Node.json"
node -e 'JSON.parse(require("node:fs").readFileSync(process.argv[1], "utf8"))' "$out/node-sqlite--Node.json" \
  && echo "recorded      node-sqlite ($(echo "$binaries" | grep -c .) binaries)"

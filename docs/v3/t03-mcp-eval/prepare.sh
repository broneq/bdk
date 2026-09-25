#!/usr/bin/env bash
# Prepare the benchmark worktree and BDK plugin copy for one configuration.
# Usage: BENCH=<scratch dir> prepare.sh <C0|CG|CS|CGS>
# Expects $BENCH/vk-snap (history-free snapshot) and $BENCH/bdk-cdea721 (BDK at cdea721), see README.md.
set -euo pipefail

cfg="$1"
here="$(cd "$(dirname "$0")" && pwd)"
: "${BENCH:?set BENCH to the scratch benchmark directory}"
wt="$BENCH/wt/$cfg"
plugin="$BENCH/bdk-$cfg"

rsync -a --delete --exclude .git "$BENCH/bdk-cdea721/" "$plugin/"
cp "$here/configs/$cfg.mcp.json" "$plugin/.mcp.json"

if [ ! -d "$wt" ]; then
  git -C "$BENCH/vk-snap" worktree add -q --detach "$wt" HEAD
fi
cd "$wt"
git reset -q --hard
git clean -q -fdx -e node_modules -e .bdk -e .serena -e .code-review-graph
pnpm install --frozen-lockfile --offline >/dev/null
mkdir -p .bdk .serena
cp "$here/configs/$cfg.bdk-settings.json" .bdk/settings.json
cp "$here/configs/serena-project.yml" .serena/project.yml

case "$cfg" in
  CG|CGS)
    if [ ! -f .code-review-graph/graph.db ]; then
      uvx code-review-graph build >/dev/null
    fi
    ;;
esac
echo "prepared $cfg at $wt"

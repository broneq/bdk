#!/usr/bin/env bash
# An empty ESM project whose tests run with Node's built-in runner.
set -euo pipefail
mkdir -p src
cat > package.json <<'JSON'
{
  "name": "shop-utils",
  "private": true,
  "type": "module",
  "scripts": { "test": "node --test" }
}
JSON
git init -q && git add -A && git -c user.name=eval -c user.email=eval@example.com commit -qm init

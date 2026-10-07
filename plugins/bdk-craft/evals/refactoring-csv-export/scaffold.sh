#!/usr/bin/env bash
set -euo pipefail
mkdir -p src
cat > package.json <<'JSON'
{
  "name": "shop",
  "private": true,
  "type": "module",
  "scripts": { "test": "node --test" }
}
JSON
cat > src/exportCsv.js <<'JS'
export function csv(rows) { let out = "id;name;price\n"; for (let i = 0; i < rows.length; i++) { let r = rows[i]; let n = r.name; if (n.indexOf(";") >= 0) { n = '"' + n + '"' } let p = r.price; if (p == null) { p = "" } else { p = (Math.round(p * 100) / 100).toString().replace(".", ",") } out = out + r.id + ";" + n + ";" + p + "\n" } return out }
JS
git init -q && git add -A && git -c user.name=eval -c user.email=eval@example.com commit -qm "legacy code"

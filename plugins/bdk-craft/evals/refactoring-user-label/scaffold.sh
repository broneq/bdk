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
cat > src/userLabel.js <<'JS'
export function label(u) { var s = ""; if (u.first && u.last) { s = u.first + " " + u.last } else if (u.first) { s = u.first } else { s = u.email.split("@")[0] } if (u.role == "admin") s = s + " (admin)"; if (u.role == "operator") s = s + " (operator)"; if (s.length > 24) s = s.substring(0, 23) + "…"; return s }
JS
git init -q && git add -A && git -c user.name=eval -c user.email=eval@example.com commit -qm "legacy code"

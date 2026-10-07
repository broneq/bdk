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
cat > src/shippingCost.js <<'JS'
export function cost(o) { let c = 0; if (o.country == "PL") { if (o.total > 100) { c = 0 } else { if (o.express) { c = 25 } else { c = 12 } } } else { if (o.express) { c = 60 } else { c = 35 } if (o.total > 400) { c = c / 2 } } return c }
JS
git init -q && git add -A && git -c user.name=eval -c user.email=eval@example.com commit -qm "legacy code"

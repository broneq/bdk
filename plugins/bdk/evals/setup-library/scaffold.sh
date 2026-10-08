#!/usr/bin/env bash
set -euo pipefail
bash "$(dirname "$0")/../fixtures/tiny-ledger.sh"
# A lavish-axi stub that npx -y runs first: Lavish does not run in this session.
mkdir -p node_modules/lavish-axi node_modules/.bin
cat > node_modules/lavish-axi/package.json <<'JSON'
{ "name": "lavish-axi", "version": "0.0.0-eval", "bin": { "lavish-axi": "cli.js" } }
JSON
cat > node_modules/lavish-axi/cli.js <<'JS'
#!/usr/bin/env node
console.error("lavish-axi: cannot run in this session");
process.exit(1);
JS
chmod +x node_modules/lavish-axi/cli.js
ln -s ../lavish-axi/cli.js node_modules/.bin/lavish-axi

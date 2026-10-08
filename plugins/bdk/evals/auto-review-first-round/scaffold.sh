#!/usr/bin/env bash
# monthly-report with round 1 recorded and nothing reviewed yet; manual review gate, and a
# lavish-axi stub that cannot open a page, so triage has to ask in the reply.
set -euo pipefail
bash "$(dirname "$0")/../fixtures/monthly-report.sh"
# claude -p stops background tasks 10 minutes after its last turn; a round can take longer.
cat > .bdk/settings.local.yaml <<'YAML'
execution:
  lead: foreground
YAML
mkdir -p node_modules/lavish-axi node_modules/.bin
cat > node_modules/lavish-axi/package.json <<'JSON'
{ "name": "lavish-axi", "version": "0.0.0-eval", "bin": { "lavish-axi": "cli.js" } }
JSON
cat > node_modules/lavish-axi/cli.js <<'JS'
#!/usr/bin/env node
const [cmd] = process.argv.slice(2);
if (cmd === "playbook" || cmd === "--help" || cmd === "--version") console.log("Write one card per item to decide and a Send button.");
else { console.error("lavish-axi: cannot open a browser review in this session"); process.exit(1); }
JS
chmod +x node_modules/lavish-axi/cli.js
ln -s ../lavish-axi/cli.js node_modules/.bin/lavish-axi

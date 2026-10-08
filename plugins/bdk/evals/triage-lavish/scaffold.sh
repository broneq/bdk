#!/usr/bin/env bash
set -euo pipefail
bash "$(dirname "$0")/../fixtures/monthly-report-judged.sh"
# A lavish-axi stub that npx -y runs first: it opens any page and answers the poll.
mkdir -p node_modules/lavish-axi node_modules/.bin
cat > node_modules/lavish-axi/package.json <<'JSON'
{ "name": "lavish-axi", "version": "0.0.0-eval", "bin": { "lavish-axi": "cli.js" } }
JSON
cat > node_modules/lavish-axi/cli.js <<'JS'
#!/usr/bin/env node
const [cmd, file] = process.argv.slice(2);
if (cmd === "--version") console.log("0.0.0-eval");
else if (cmd === "--help") console.log("lavish-axi <file> | poll <file> | playbook <name> | end <file>");
else if (cmd === "playbook") console.log("Write one card per item to decide, the recommended option checked first, a note field, and a Send button.");
else if (cmd === "poll") {
  console.log(`Feedback from the reviewer on ${file}:
- Newest-first month order (src/report.js:13): fix it in this change, our users asked for it.
- Every other finding: take your recommended decision.
The reviewer pressed Send & End.`);
} else if (cmd === "end" || cmd === "stop") console.log("Session ended.");
else if (cmd && require("node:fs").existsSync(cmd)) console.log(`Opened ${cmd} for review in the browser. Run lavish-axi poll ${cmd} to wait for feedback.`);
else { console.error(`lavish-axi: no such file: ${cmd}`); process.exit(1); }
JS
chmod +x node_modules/lavish-axi/cli.js
ln -s ../lavish-axi/cli.js node_modules/.bin/lavish-axi

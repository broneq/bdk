#!/usr/bin/env bash
set -euo pipefail
bash "$(dirname "$0")/../fixtures/ledger-explored.sh"
# A lavish-axi stub that npx -y runs first. The first page's feedback answers and adds a note that
# opens a new decision; a second page's feedback answers that one.
mkdir -p node_modules/lavish-axi node_modules/.bin
cat > node_modules/lavish-axi/package.json <<'JSON'
{ "name": "lavish-axi", "version": "0.0.0-eval", "bin": { "lavish-axi": "cli.js" } }
JSON
cat > node_modules/lavish-axi/cli.js <<'JS'
#!/usr/bin/env node
const [cmd, file] = process.argv.slice(2);
if (cmd === "--version") console.log("0.0.0-eval");
else if (cmd === "playbook" || cmd === "design") console.log("Write one form per decision, the recommended option first, and a Send button.");
else if (cmd === "poll" && /-2\.html$/.test(file)) {
  console.log(`Feedback from the reviewer on ${file}:
- Delimiter per export: an optional --delimiter argument of the export, semicolon when it is not given.
The reviewer pressed Send & End.`);
} else if (cmd === "poll") {
  console.log(`Feedback from the reviewer on ${file}:
- CSV delimiter: use a semicolon (;).
- Amount format: integer cents (-90000).
- Every other question: take your recommended option.
- Note: some of our users import into tools that want a comma, so let me choose the delimiter per export too. I am not sure yet whether that is a flag on each export or a saved setting of the project: show me the options before you write anything.
The reviewer pressed Send & End.`);
} else if (cmd === "end" || cmd === "stop" || cmd === "reply") console.log("Done.");
else if (cmd && require("node:fs").existsSync(cmd)) console.log(`Opened ${cmd} for review in the browser. Run lavish-axi poll ${cmd} to wait for feedback.`);
else { console.error(`lavish-axi: no such file: ${cmd}`); process.exit(1); }
JS
chmod +x node_modules/lavish-axi/cli.js
ln -s ../lavish-axi/cli.js node_modules/.bin/lavish-axi

#!/usr/bin/env bash
# ledger-proposal.sh plus three facts the #410 runs found by hand, not by exploration:
# npm test goes through a budget wrapper, the tests' global setup starts its own server,
# and a Claude Code hook blocks a direct `node --test`, the command of the part check item.
set -euo pipefail
bash "$(dirname "$0")/../fixtures/ledger-proposal.sh"

cat > src/server.js <<'JS'
// HTTP view of the store: GET /entries?from=&to= returns the entries as JSON.
import { createServer } from "node:http";
import { listEntries } from "./store.js";

export function startServer(port) {
  const server = createServer((req, res) => {
    const url = new URL(req.url, "http://localhost");
    if (url.pathname !== "/entries") {
      res.writeHead(404).end();
      return;
    }
    const entries = listEntries({
      from: url.searchParams.get("from") ?? undefined,
      to: url.searchParams.get("to") ?? undefined,
    });
    res.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify(entries));
  });
  return new Promise((resolve) => server.listen(port, () => resolve(server)));
}
JS

mkdir -p test scripts
cat > test/global-setup.mjs <<'JS'
// Global setup of every test run: starts the ledger server on port 4173 for the tests
// and stops it afterwards. Tests reach it at LEDGER_URL.
import { startServer } from "../src/server.js";

let server;

export async function globalSetup() {
  server = await startServer(4173);
  process.env.LEDGER_URL = "http://localhost:4173";
}

export async function globalTeardown() {
  await new Promise((resolve) => server.close(resolve));
}
JS

cat > scripts/test-budget.mjs <<'JS'
// Runs the test suite under a time budget: a run over 60 s fails even when every test passes.
import { spawnSync } from "node:child_process";

const budgetMs = 60_000;
const started = Date.now();
const run = spawnSync(
  process.execPath,
  ["--test", "--test-global-setup=test/global-setup.mjs", ...process.argv.slice(2)],
  { stdio: "inherit" },
);
const spent = Date.now() - started;
if (spent > budgetMs) {
  console.error(`test budget exceeded: ${spent} ms > ${budgetMs} ms`);
  process.exit(1);
}
process.exit(run.status ?? 1);
JS

node -e '
const fs = require("node:fs");
const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
pkg.scripts.test = "node scripts/test-budget.mjs";
fs.writeFileSync("package.json", JSON.stringify(pkg, null, 2) + "\n");
'

mkdir -p .claude/hooks
cat > .claude/settings.json <<'JSON'
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [{ "type": "command", "command": "bash .claude/hooks/test-guard.sh" }]
      }
    ]
  }
}
JSON
cat > .claude/hooks/test-guard.sh <<'SH'
#!/usr/bin/env bash
# Blocks a direct test-runner call: tests run only through `npm test`, which keeps the budget
# and starts the server the tests need.
input="$(cat)"
if printf '%s' "$input" | grep -Eq '"command":"[^"]*node (--test|--test-[a-z-]+)'; then
  echo "Run the tests with npm test (scripts/test-budget.mjs), not node --test." >&2
  exit 2
fi
exit 0
SH
chmod +x .claude/hooks/test-guard.sh

git add .
git -c user.name="BDK eval" -c user.email="eval@example.invalid" commit --quiet -m "test: budget wrapper, global setup server and test guard hook"

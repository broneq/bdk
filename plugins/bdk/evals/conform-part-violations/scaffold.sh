#!/usr/bin/env bash
set -euo pipefail
bash "$(dirname "$0")/../fixtures/ledger-implemented.sh"
cat > CLAUDE.md <<'MD'
# tiny-ledger

- Import Node built-in modules with the `node:` prefix (`node:fs`, `node:assert/strict`), never by the bare name.
MD
git add CLAUDE.md
git -c user.name="BDK eval" -c user.email="eval@example.invalid" commit --quiet -m "docs: project instructions"
# Three violations in the uncommitted part, each fixable without changing behaviour.
node -e '
const fs = require("node:fs");
const edit = (file, before, after) => {
  const text = fs.readFileSync(file, "utf8");
  if (!text.includes(before)) throw new Error(`fixture changed: ${file}`);
  fs.writeFileSync(file, text.replace(before, after));
};
edit("src/csv.js", "export function toCsv(entries) {\n", "// Added for the CSV export feature (part 01).\nexport function toCsv(entries) {\n  // Step 1: header\n");
edit("src/csv.js", "  for (const entry of entries) {\n", "  // Step 2: one line per entry\n  for (const entry of entries) {\n");
edit("src/csv.js", "function formatCents(cents) {", "export function formatCents(cents) {");
edit("src/csv.test.js", "import assert from \"node:assert/strict\";", "import assert from \"assert/strict\";");
'

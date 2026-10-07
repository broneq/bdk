#!/usr/bin/env bash
# A small Node command-line tool with one commit: a bin entry, node --test, no build.
set -euo pipefail

cat > package.json <<'JSON'
{
  "name": "ledger-cli",
  "version": "1.0.0",
  "type": "module",
  "bin": { "ledger": "bin/ledger.js" },
  "scripts": { "test": "node --test" }
}
JSON

cat > package-lock.json <<'JSON'
{
  "name": "ledger-cli",
  "version": "1.0.0",
  "lockfileVersion": 3,
  "requires": true,
  "packages": { "": { "name": "ledger-cli", "version": "1.0.0", "bin": { "ledger": "bin/ledger.js" } } }
}
JSON

cat > README.md <<'MD'
# ledger-cli

Sums the amounts of a ledger file: `ledger sum entries.csv`.
MD

mkdir -p bin src
cat > bin/ledger.js <<'JS'
#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { sum } from "../src/sum.js";

const [command, file] = process.argv.slice(2);
if (command === "--help" || command === undefined) {
  console.log("Usage: ledger sum <file.csv>");
  process.exit(0);
}
if (command === "sum") {
  console.log(sum(readFileSync(file, "utf8")));
} else {
  console.error(`unknown command: ${command}`);
  process.exit(2);
}
JS
chmod +x bin/ledger.js

cat > src/sum.js <<'JS'
export function sum(csv) {
  return csv
    .trim()
    .split("\n")
    .map((line) => Number(line.split(",")[1]))
    .reduce((total, amount) => total + amount, 0);
}
JS

cat > src/sum.test.js <<'JS'
import { test } from "node:test";
import assert from "node:assert/strict";
import { sum } from "./sum.js";

test("sum adds the second column", () => {
  assert.equal(sum("rent,-5\npay,7\n"), 2);
});
JS

git init --quiet --initial-branch=main
git add .
git -c user.name="BDK eval" -c user.email="eval@example.invalid" commit --quiet -m "feat: ledger cli"

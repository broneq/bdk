#!/usr/bin/env bash
# Shared fixture, B1 size, ready to plan: the Node CLI `ledger` configured for BDK, with the
# OpenSpec Change add-household-book (7 capabilities; proposal, spec deltas and design) whose
# design passed verification and the design gate. The Change's markdown and the approval
# records are copied from household-book/; household-book-planned.sh adds the plan.
# See ../README.md, "B1-sized fixture".
set -euo pipefail

here="$(cd "$(dirname "$0")" && pwd)"
data="$here/household-book"
export GIT_AUTHOR_DATE="2026-10-01T10:00:00Z" GIT_COMMITTER_DATE="2026-10-01T10:00:00Z"
commit() {
  git add -A
  git -c user.name="BDK eval" -c user.email="eval@example.invalid" commit --quiet -m "$1"
}

cat > package.json <<'JSON'
{
  "name": "ledger",
  "version": "1.2.0",
  "type": "module",
  "bin": { "ledger": "bin/ledger.js" },
  "engines": { "node": ">=22" },
  "scripts": { "test": "node --test" }
}
JSON

cat > README.md <<'MD'
# ledger

Keeps a ledger of income and expenses in `ledger.json` in the current directory.

    ledger add -12.50 Coffee beans
    ledger balance

Amounts are decimal units with up to two decimals; the book stores them as integer cents.
MD

mkdir -p bin src test
cat > bin/ledger.js <<'JS'
#!/usr/bin/env node
import { loadBook, saveBook } from "../src/book.js";
import { formatCents, parseAmount } from "../src/money.js";

const USAGE = "usage: ledger add <amount> <description> | ledger balance";
const [command, ...args] = process.argv.slice(2);

function fail(message) {
  console.error(`ledger: ${message}`);
  process.exit(2);
}

function read() {
  try {
    return loadBook();
  } catch {
    return fail("cannot read ledger.json");
  }
}

if (command === "add") {
  const [amountText = "", ...words] = args;
  let amount;
  try {
    amount = parseAmount(amountText);
  } catch {
    fail(`not an amount: ${amountText}`);
  }
  const description = words.join(" ");
  if (description === "") fail("add needs a description");
  const entries = read();
  entries.push({ date: new Date().toISOString().slice(0, 10), description, amount });
  saveBook(entries);
  console.log(`Added ${formatCents(amount)} ${description}`);
} else if (command === "balance") {
  const total = read().reduce((sum, entry) => sum + entry.amount, 0);
  console.log(`Balance: ${formatCents(total)}`);
} else if (command === undefined || command === "--help") {
  console.log(USAGE);
} else {
  fail(`unknown command ${command}`);
}
JS
chmod +x bin/ledger.js

cat > src/money.js <<'JS'
// Amounts are integer cents in the book; on the command line they are decimal units with up
// to two decimals and an optional sign.

export function parseAmount(text) {
  const match = /^([+-]?)(\d+)(?:\.(\d{1,2}))?$/.exec(String(text).trim());
  if (match === null) throw new Error(`not an amount: ${text}`);
  const [, sign, units, decimals = ""] = match;
  const cents = Number(units) * 100 + Number(decimals.padEnd(2, "0"));
  return sign === "-" ? -cents : cents;
}

export function formatCents(cents) {
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(cents);
  return `${sign}${Math.trunc(abs / 100)}.${String(abs % 100).padStart(2, "0")}`;
}
JS

cat > src/money.test.js <<'JS'
import { test } from "node:test";
import assert from "node:assert/strict";
import { formatCents, parseAmount } from "./money.js";

test("parseAmount reads decimal units into cents", () => {
  assert.equal(parseAmount("12.5"), 1250);
  assert.equal(parseAmount("-1200"), -120000);
  assert.equal(parseAmount("+0.07"), 7);
});

test("parseAmount refuses what is not an amount", () => {
  assert.throws(() => parseAmount("12.345"));
  assert.throws(() => parseAmount("ten"));
  assert.throws(() => parseAmount(""));
});

test("formatCents writes two decimals", () => {
  assert.equal(formatCents(-120000), "-1200.00");
  assert.equal(formatCents(5), "0.05");
  assert.equal(formatCents(0), "0.00");
});
JS

cat > src/book.js <<'JS'
// The book file: a JSON array of entries { date, description, amount } in the current
// directory. A missing file is an empty book.
import { existsSync, readFileSync, writeFileSync } from "node:fs";

export const BOOK_FILE = "ledger.json";

export function loadBook(path = BOOK_FILE) {
  if (!existsSync(path)) return [];
  const entries = JSON.parse(readFileSync(path, "utf8"));
  if (!Array.isArray(entries)) throw new Error(`${path} is not a ledger file`);
  return entries;
}

export function saveBook(entries, path = BOOK_FILE) {
  writeFileSync(path, `${JSON.stringify(entries, null, 2)}\n`);
}
JS

cat > src/book.test.js <<'JS'
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadBook, saveBook } from "./book.js";

const dir = () => mkdtempSync(join(tmpdir(), "ledger-book-"));

test("a missing book is empty", () => {
  assert.deepEqual(loadBook(join(dir(), "ledger.json")), []);
});

test("a saved book loads back", () => {
  const path = join(dir(), "ledger.json");
  const entries = [{ date: "2026-10-01", description: "Rent", amount: -90000 }];
  saveBook(entries, path);
  assert.deepEqual(loadBook(path), entries);
});

test("a file that is not an array is refused", () => {
  const path = join(dir(), "ledger.json");
  writeFileSync(path, "{}");
  assert.throws(() => loadBook(path));
});
JS

cat > test/cli.test.js <<'JS'
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const BIN = join(import.meta.dirname, "..", "bin", "ledger.js");

function ledger(cwd, ...args) {
  const { status, stdout, stderr } = spawnSync(process.execPath, [BIN, ...args], {
    cwd,
    encoding: "utf8",
  });
  return { status, stdout, stderr };
}

test("add and balance", () => {
  const cwd = mkdtempSync(join(tmpdir(), "ledger-cli-"));
  assert.equal(ledger(cwd, "add", "100", "Salary").stdout, "Added 100.00 Salary\n");
  ledger(cwd, "add", "-12.50", "Coffee", "beans");
  assert.equal(ledger(cwd, "balance").stdout, "Balance: 87.50\n");
});

test("an empty directory has a zero balance", () => {
  const cwd = mkdtempSync(join(tmpdir(), "ledger-cli-"));
  assert.equal(ledger(cwd, "balance").stdout, "Balance: 0.00\n");
});

test("a bad amount exits 2", () => {
  const cwd = mkdtempSync(join(tmpdir(), "ledger-cli-"));
  const result = ledger(cwd, "add", "ten", "Lunch");
  assert.equal(result.status, 2);
  assert.equal(result.stderr, "ledger: not an amount: ten\n");
});

test("an unreadable book exits 2", () => {
  const cwd = mkdtempSync(join(tmpdir(), "ledger-cli-"));
  writeFileSync(join(cwd, "ledger.json"), "{");
  const result = ledger(cwd, "balance");
  assert.equal(result.status, 2);
  assert.equal(result.stderr, "ledger: cannot read ledger.json\n");
});

test("an unknown command exits 2", () => {
  const cwd = mkdtempSync(join(tmpdir(), "ledger-cli-"));
  const result = ledger(cwd, "remove");
  assert.equal(result.status, 2);
  assert.equal(result.stderr, "ledger: unknown command remove\n");
});
JS

mkdir -p .bdk
cat > .bdk/settings.yaml <<'YAML'
# BDK project settings. Resolved values with their origins: bdk config show
languages: [javascript]
tools:
  test:
    - id: node-test
      command: npm test
      when: [wave, review]
    - id: node-test-changed
      command: node --test {files}
      paths: ["**/*.test.js"]
      when: [part]
  e2e:
    - id: cli
      start: node bin/ledger.js --help
      ready: node bin/ledger.js --help
      driver: cli
YAML

cat > .gitignore <<'TXT'
/.bdk/runs/
/.bdk/settings.local.yaml
node_modules/
ledger.json
TXT

mkdir -p openspec/schemas openspec/specs/ledger openspec/changes/archive
cp -R "$here/../../openspec/schemas/bdk" openspec/schemas/bdk
cat > openspec/config.yaml <<'YAML'
schema: bdk
YAML
touch openspec/changes/archive/.gitkeep
cp "$data/specs/ledger/spec.md" openspec/specs/ledger/spec.md
git init --quiet --initial-branch=main
commit "feat: ledger add and balance"

change=openspec/changes/add-household-book
mkdir -p "$change"
cp "$data/change/.openspec.yaml" "$data/change/proposal.md" "$data/change/design.md" "$change/"
cp -R "$data/change/specs" "$change/specs"
mkdir -p .bdk/runs/add-household-book
cp -R "$data/runs/design" .bdk/runs/add-household-book/design
commit "docs: propose and design add-household-book"

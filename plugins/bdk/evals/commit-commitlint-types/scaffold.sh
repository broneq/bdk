#!/usr/bin/env bash
# A project whose commitlint config allows only its own types and scopes, with a staged
# feature in src/billing/.
set -euo pipefail

git init --quiet --initial-branch=main
git config user.name "Shop Dev"
git config user.email "dev@shop.example.invalid"

cat > package.json <<'JSON'
{
  "name": "tiny-shop",
  "version": "2.1.0",
  "type": "module",
  "scripts": { "test": "node --test" },
  "devDependencies": { "@commitlint/cli": "^19.0.0" }
}
JSON
cat > commitlint.config.mjs <<'JS'
export default {
  rules: {
    "type-enum": [2, "always", ["add", "change", "fix", "remove", "docs", "chore"]],
    "scope-enum": [2, "always", ["billing", "auth", "web"]],
    "scope-empty": [2, "never"],
    "subject-case": [2, "always", "lower-case"],
    "header-max-length": [2, "always", 50],
  },
};
JS
mkdir -p src/billing src/auth
cat > src/auth/session.js <<'JS'
export function isExpired(session, now) {
  return session.expiresAt <= now;
}
JS
git add .
git commit --quiet -m "chore(web): set up the project"

cat > src/billing/invoice.js <<'JS'
export function invoiceNumber(year, sequence) {
  return `INV-${year}-${String(sequence).padStart(4, "0")}`;
}
JS
git add .
git commit --quiet -m "chore(billing): number invoices per year"

cat >> src/billing/invoice.js <<'JS'

const DAY_MS = 24 * 60 * 60 * 1000;

/** Payment is due 30 days after the invoice is issued, unless the customer has other terms. */
export function dueDate(issuedAt, termDays = 30) {
  return new Date(issuedAt.getTime() + termDays * DAY_MS);
}
JS
git add src/billing/invoice.js

# Start the reflog and the last message fresh, so graders see only the commits of the run.
rm -f .git/COMMIT_EDITMSG .git/logs/HEAD

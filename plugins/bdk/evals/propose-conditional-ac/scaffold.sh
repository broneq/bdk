#!/usr/bin/env bash
# tiny-ledger configured for BDK under policy.questions decide-and-record, with a seed helper that
# cannot mark an entry void, plus issue 42 (a conditional point, an acceptance step by hand and a
# comment) and the offline gh stand-in in .git/bdk-eval/.
set -euo pipefail
bash "$(dirname "$0")/../fixtures/tiny-ledger-bdk.sh"

cat >> .bdk/settings.yaml <<'YAML'
policy:
  questions: decide-and-record
YAML

cat > src/seed.js <<'JS'
// Builds ledger entries for tests and the sample ledger from a list of amounts.
export function seedEntries(amounts) {
  return amounts.map((amount) => ({ amount }));
}
JS
git add .
git -c user.name="BDK eval" -c user.email="eval@example.invalid" commit --quiet -m "test: seed helper"

mkdir -p .git/bdk-eval/issues .git/bdk-eval/bin
cp "$(dirname "$0")/../fixtures/bin/gh" .git/bdk-eval/bin/gh
cat > .git/bdk-eval/issues/42.json <<'JSON'
{
  "number": 42,
  "title": "Skip void entries in the balance",
  "state": "OPEN",
  "url": "https://github.com/acme/tiny-ledger/issues/42",
  "labels": [{ "id": "LA_1", "name": "bug", "description": "Something is wrong", "color": "d73a4a" }],
  "body": "## Goal\nA voided entry must not count towards the balance.\n\n## Scope\n- An entry can be marked void (`void: true`).\n- `balance` skips void entries: today it sums every entry.\n- Add the void variant to the seeded test entries if the seed helper can mark an entry void.\n\n## Acceptance signal\n- The balance of entries 5, -2 and a void 10 is 3.\n- Check by hand once: compute the balance of the seeded entries 5, -2 and a void 10 in a Node REPL and see 3.\n\n## Dependencies\nNone.",
  "comments": [
    { "author": { "login": "acme-lead" }, "body": "Keep `balance` synchronous: every caller uses its return value directly.", "createdAt": "2026-10-14T09:12:00Z" }
  ]
}
JSON

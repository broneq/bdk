#!/usr/bin/env bash
# tiny-ledger configured for BDK, plus issue 42 and the offline gh stand-in (fixtures/bin/gh) in
# .git/bdk-eval/, which the run reaches through the relative PATH entry .git/bdk-eval/bin.
set -euo pipefail
bash "$(dirname "$0")/../fixtures/tiny-ledger-bdk.sh"

mkdir -p .git/bdk-eval/issues .git/bdk-eval/bin
cp "$(dirname "$0")/../fixtures/bin/gh" .git/bdk-eval/bin/gh
cat > .git/bdk-eval/issues/42.json <<'JSON'
{
  "number": 42,
  "title": "Export the ledger as CSV",
  "state": "OPEN",
  "url": "https://github.com/acme/tiny-ledger/issues/42",
  "labels": [{ "id": "LA_1", "name": "enhancement", "description": "New feature or request", "color": "a2eeef" }],
  "body": "## Goal\nAccountants want the ledger in a spreadsheet.\n\n## Scope\n- Export the entries as CSV: one row per entry with the columns `date`, `description` and `amount`, and a header row.\n- An entry can be marked void. Void entries are left out of the export, and `balance` must skip them too: today it sums every entry.\n\n## Acceptance signal\n- Exporting entries of 5, -2 and a void 10 gives a header and two rows.\n- The balance of those entries is 3.\n\n## Out of scope\n- Several currencies: #40 owns them.\n\n## Dependencies\nNone."
}
JSON

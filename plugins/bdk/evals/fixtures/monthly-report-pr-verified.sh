#!/usr/bin/env bash
# Shared fixture: monthly-report-pr-reviewed.sh after a first /bdk:pr-review --verify. The
# offline gh stand-in holds review 2 of pull request 7, a verify review of the eval user at the
# current head (marker `kind=verify-summary head=<head>`): the parse finding fixed, its thread
# PRRT_7_1_1 resolved, the report finding left with its thread PRRT_7_1_2 open. The author
# pushed nothing since, so a second verify has no commit to review. See ../README.md, "Shared
# fixtures".
set -euo pipefail

here="$(cd "$(dirname "$0")" && pwd)"
bash "$here/monthly-report-pr-reviewed.sh"

reviewed=$(node -p 'JSON.parse(require("fs").readFileSync(".git/bdk-eval/reviews/7-1.json", "utf8")).commit_id')
head=$(git rev-parse origin/monthly-report)
cat > .git/bdk-eval/reviews/7-2.json <<JSON
{
  "commit_id": "$head",
  "event": "REQUEST_CHANGES",
  "body": "## BDK review: verification\n\nChecked the previous review (https://github.com/bdk-eval/repo/pull/7#pullrequestreview-1, \`${reviewed:0:7}\`) at \`${head:0:7}\`: 1 fixed, 1 left. Reviewed the commits since \`${reviewed:0:7}\`: 0 new findings, 0 blocking.\n\n**Verdict: Request changes**\n\n**Left**\n- \`src/report.js:14\` - **[blocker]** The report formats the cents of parseEntries as currency units. \`monthlyTotals\` still calls \`total.toFixed(2)\` on integer cents, so the scenario \"Totals per month\" prints 1250.00 for 12.50.\n\n**Fixed**\n- \`src/parse.js:13\` - Amounts with fewer than two decimals parse to the wrong number of cents. The fraction is padded to two digits, so 7 gives 700 and 12.5 gives 1250 (thread resolved)\n\n<!-- bdk-pr-review v3 kind=verify-summary verdict=request-changes head=$head -->",
  "comments": []
}
JSON
echo '["PRRT_7_1_1"]' > .git/bdk-eval/resolved.json

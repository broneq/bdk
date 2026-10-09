#!/usr/bin/env bash
# Shared fixture: monthly-report-pr.sh after a /bdk:pr-review review and the author's answer.
# The offline gh stand-in holds review 1 of pull request 7, posted by the eval user with the
# summary marker and two inline `blocker` comments (threads PRRT_7_1_1 on src/parse.js and
# PRRT_7_1_2 on src/report.js). Then the author pushed one commit to the pull request that fixes
# only the parse bug: amounts with fewer than two decimals now parse to the right cents, while
# the report still formats cents as dollars. See ../README.md, "Shared fixtures".
set -euo pipefail

here="$(cd "$(dirname "$0")" && pwd)"
bash "$here/monthly-report-pr.sh"

reviewed=$(git rev-parse origin/monthly-report)
mkdir -p .git/bdk-eval/reviews
cat > .git/bdk-eval/reviews/7-1.json <<JSON
{
  "commit_id": "$reviewed",
  "event": "REQUEST_CHANGES",
  "body": "## BDK review\n\nAdds \`ledger report <file>\`, the total of each month in currency units.\n\n**Verdict: Request changes**\n\nReviewed \`${reviewed:0:7}\` against \`main\`, with the OpenSpec Change \`openspec/changes/monthly-report\`: 2 findings posted, 2 blocking.\n\n**Blocking**\n- \`src/parse.js:13\` - Amounts with fewer than two decimals parse to the wrong number of cents (inline)\n- \`src/report.js:14\` - The report formats the cents of parseEntries as currency units (inline)\n\n<!-- bdk-pr-review v3 kind=summary verdict=request-changes head=$reviewed -->",
  "comments": [
    {
      "path": "src/parse.js",
      "line": 13,
      "side": "RIGHT",
      "body": "**[blocker]** Amounts with fewer than two decimals parse to the wrong number of cents\n\n\`parseEntries('2026-01-05,rent,7')\` gives amount 7 and \`12.5\` gives 125; the scenario \"Amounts with fewer decimals\" needs 700 and 1250.\n\n<!-- bdk-pr-review v3 kind=finding id=f-0a1b2c3d4e5f level=blocker -->"
    },
    {
      "path": "src/report.js",
      "line": 14,
      "side": "RIGHT",
      "body": "**[blocker]** The report formats the cents of parseEntries as currency units\n\n\`monthlyTotals\` calls \`total.toFixed(2)\` on integer cents, so \`2026-01-05,rent,12.50\` prints \`2026-01 1250.00\` instead of \`2026-01 12.50\`; the tests build dollar entries by hand.\n\n<!-- bdk-pr-review v3 kind=finding id=f-6a7b8c9d0e1f level=blocker -->"
    }
  ]
}
JSON

export GIT_AUTHOR_DATE="2026-10-02T10:00:00Z" GIT_COMMITTER_DATE="2026-10-02T10:00:00Z"
git checkout --quiet --detach "$reviewed"
cat > src/parse.js <<'JS'
/**
 * Reads the lines `date,description,amount` of a ledger file.
 * @param {string} csv
 * @returns {{ date: string, amount: number }[]} entries, `amount` in integer cents
 */
export function parseEntries(csv) {
  if (!csv.trim()) return [];
  return csv
    .trim()
    .split("\n")
    .map((line) => {
      const [date, , amt] = line.split(",");
      const negative = amt.trim().startsWith("-");
      const [whole, fraction = ""] = amt.trim().replace("-", "").split(".");
      const cents = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
      return { date, amount: negative ? -cents : cents };
    });
}
JS
cat >> src/parse.test.js <<'JS'

test("amounts with fewer decimals are read in cents", () => {
  assert.deepEqual(parseEntries("2026-01-05,a,7\n2026-01-06,b,12.5\n2026-01-07,c,-3.25\n"), [
    { date: "2026-01-05", amount: 700 },
    { date: "2026-01-06", amount: 1250 },
    { date: "2026-01-07", amount: -325 },
  ]);
});
JS
git add -A
git -c user.name="Teammate" -c user.email="teammate@example.invalid" commit --quiet \
  -m "fix(ledger): read amounts with fewer than two decimals"
head=$(git rev-parse HEAD)
git push --quiet --force origin HEAD:monthly-report HEAD:refs/pull/7/head
git checkout --quiet main
git fetch --quiet origin

node -e '
const fs = require("fs");
const file = ".git/bdk-eval/prs/7.json";
const pr = JSON.parse(fs.readFileSync(file, "utf8"));
pr.headRefOid = process.argv[1];
fs.writeFileSync(file, JSON.stringify(pr, null, 2) + "\n");
' "$head"

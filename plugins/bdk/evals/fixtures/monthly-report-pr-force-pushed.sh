#!/usr/bin/env bash
# Shared fixture: monthly-report-pr-reviewed.sh after the author squashed the pull request and
# force-pushed it. The new head is one commit on the merge base with the same tree as the
# reviewed head plus the parse fix, so the head of review 1 is no longer in the pull request's
# history: a verify round reviews the whole pull request. The parse bug is fixed, the report
# still formats cents as dollars. See ../README.md, "Shared fixtures".
set -euo pipefail

here="$(cd "$(dirname "$0")" && pwd)"
bash "$here/monthly-report-pr-reviewed.sh"

export GIT_AUTHOR_DATE="2026-10-03T10:00:00Z" GIT_COMMITTER_DATE="2026-10-03T10:00:00Z"
git checkout --quiet --detach "$(git rev-parse origin/monthly-report)"
git reset --quiet --soft "$(git merge-base HEAD origin/main)"
git -c user.name="Teammate" -c user.email="teammate@example.invalid" commit --quiet \
  -m "feat(ledger): monthly report"
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

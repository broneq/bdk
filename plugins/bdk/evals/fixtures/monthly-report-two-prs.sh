#!/usr/bin/env bash
# Shared fixture: monthly-report-pr.sh plus pull request 8 of the same teammate, a correct
# one-line README change on its own branch `help-in-readme` from `main` (also pushed as
# `refs/pull/8/head`). Two pull requests for one /bdk:pr-review call. See ../README.md,
# "Shared fixtures".
set -euo pipefail

here="$(cd "$(dirname "$0")" && pwd)"
bash "$here/monthly-report-pr.sh"

export GIT_AUTHOR_DATE="2026-10-02T10:00:00Z" GIT_COMMITTER_DATE="2026-10-02T10:00:00Z"
git checkout --quiet -b help-in-readme
cat >> README.md <<'MD'

Run `ledger --help` to see the usage.
MD
git add -A
git -c user.name="Teammate" -c user.email="teammate@example.invalid" commit --quiet \
  -m "docs: point to ledger --help in the README"
head=$(git rev-parse HEAD)
git push --quiet origin help-in-readme help-in-readme:refs/pull/8/head
git checkout --quiet main
git branch --quiet -D help-in-readme
git fetch --quiet origin

cat > .git/bdk-eval/prs/8.json <<JSON
{
  "number": 8,
  "url": "https://github.com/bdk-eval/repo/pull/8",
  "state": "OPEN",
  "isDraft": false,
  "author": { "login": "teammate" },
  "baseRefName": "main",
  "headRefName": "help-in-readme",
  "headRefOid": "$head",
  "title": "docs: point to ledger --help in the README",
  "body": "Adds one line to the README that points to \`ledger --help\` for the usage.",
  "closingIssuesReferences": []
}
JSON

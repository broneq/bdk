#!/usr/bin/env bash
# Shared fixture: monthly-report.sh as pull request 7 of a teammate. `origin` is a bare
# repository inside the workspace (.git/bdk-eval/remote.git) holding `main`, the branch
# `monthly-report` and `refs/pull/7/head`, so `git fetch origin pull/7/head` works offline. The
# user's checkout is on `main` without the branch and without run files, and the offline gh
# stand-in answers pull request 7 from .git/bdk-eval/prs/7.json. The two seeded bugs of
# monthly-report.sh are on the pull request's head. See ../README.md, "Shared fixtures".
set -euo pipefail

here="$(cd "$(dirname "$0")" && pwd)"
bash "$here/monthly-report.sh"
rm -rf .bdk/runs

git init --quiet --bare .git/bdk-eval/remote.git
git remote add origin ./.git/bdk-eval/remote.git
# A fetch from or push to a local remote runs git-upload-pack or git-receive-pack. On a Mac
# without Homebrew git, /usr/bin's shims fail in the run's sandbox ("Host limits"), so name the
# real binaries by their full path.
git config remote.origin.uploadpack "$(git --exec-path)/git-upload-pack"
git config remote.origin.receivepack "$(git --exec-path)/git-receive-pack"
git push --quiet origin main monthly-report monthly-report:refs/pull/7/head
head=$(git rev-parse monthly-report)
git checkout --quiet main
git branch --quiet -D monthly-report
git fetch --quiet origin
git symbolic-ref refs/remotes/origin/HEAD refs/remotes/origin/main
git branch --quiet --set-upstream-to=origin/main main

mkdir -p .git/bdk-eval/bin .git/bdk-eval/prs
cp "$here/bin/gh" .git/bdk-eval/bin/gh
cat > .git/bdk-eval/prs/7.json <<JSON
{
  "number": 7,
  "url": "https://github.com/bdk-eval/repo/pull/7",
  "state": "OPEN",
  "isDraft": false,
  "author": { "login": "teammate" },
  "baseRefName": "main",
  "headRefName": "monthly-report",
  "headRefOid": "$head",
  "title": "feat(ledger): monthly report",
  "body": "Adds \`ledger report <file>\`, which prints the total of each month in currency units with two decimals. Implements the OpenSpec Change \`monthly-report\` (two plan parts: parse entries in cents, then the report).",
  "closingIssuesReferences": []
}
JSON

#!/usr/bin/env bash
# Shared fixture, B1 size, planned: household-book.sh plus the approved plan of
# add-household-book (7 parts, 27 tasks, 62 files, 3 waves) and the passing plan check
# report, in one more commit. Ready to execute, or to run plan-to-PR.
# See ../README.md, "B1-sized fixture".
set -euo pipefail

here="$(cd "$(dirname "$0")" && pwd)"
data="$here/household-book"
bash "$here/household-book.sh"

export GIT_AUTHOR_DATE="2026-10-02T10:00:00Z" GIT_COMMITTER_DATE="2026-10-02T10:00:00Z"
mkdir -p openspec/changes/add-household-book/plan
cp -R "$data/change/plan/parts" openspec/changes/add-household-book/plan/parts
cp -R "$data/runs/plan" .bdk/runs/add-household-book/plan
git add -A
git -c user.name="BDK eval" -c user.email="eval@example.invalid" commit --quiet -m "docs: plan add-household-book"

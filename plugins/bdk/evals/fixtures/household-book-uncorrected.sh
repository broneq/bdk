#!/usr/bin/env bash
# Shared fixture, B1 size, queued and uncorrected: household-book-queued.sh with the Change as run 1
# of the B1 measurement found it, before design D6 of the archived Change v3-208-measure-speed-b1
# corrected it. Spec `ledger` "Options", design D2 and part 01 state no error for a missing
# positional argument and do not say that every command checks amounts, dates and months as
# `ledger add` does; part 04 reads join(io.cwd, file), so an absolute statement path is read under
# the current directory. The design gate names verify-2.md and plan/verify-1.md is the record of
# that plan. household-book/uncorrected.patch holds the difference; it is folded into the last
# commit and pushed to origin. See ../README.md, "B1-sized fixture".
set -euo pipefail

here="$(cd "$(dirname "$0")" && pwd)"
bash "$here/household-book-queued.sh"

# A patch that no longer applies fails here, so a changed fixture cannot build a different state.
git apply "$here/household-book/uncorrected.patch"

export GIT_AUTHOR_DATE="2026-10-02T10:00:00Z" GIT_COMMITTER_DATE="2026-10-02T10:00:00Z"
git add -A
git commit --quiet --amend --no-edit
git push --quiet --force origin main

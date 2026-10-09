#!/usr/bin/env bash
# The monthly-report project with a CLAUDE.md on main whose testing instruction part 01 breaks:
# src/parse.test.js calls `test` with no `describe` block named after `parseEntries`. No linter
# and no BDK pack rule checks it, so only a reviewer that reads the instructions reports it.
# The branch is rebased onto the new main commit and round-1/groups.json follows the new shas.
set -euo pipefail
bash "$(dirname "$0")/monthly-report.sh"

export GIT_AUTHOR_DATE="2026-10-01T09:00:00Z" GIT_COMMITTER_DATE="2026-10-01T09:00:00Z"
RECORD=.bdk/runs/monthly-report/review/round-1/groups.json
OLD_BASE=$(git rev-parse main)
OLD_HEAD=$(git rev-parse HEAD)

git checkout --quiet main
cat > CLAUDE.md <<'MD'
# ledger

A Node command line tool; `npm test` runs the tests with `node --test`.

## Conventions

- Group the tests of each exported function in a `describe` block named after the function (`describe("parseEntries", ...)`), with one `it` per behaviour.
- Keep the command line parsing in `bin/ledger.js`; modules under `src/` never read `process.argv`.
MD
git add CLAUDE.md
git -c user.name="BDK eval" -c user.email="eval@example.invalid" commit --quiet -m "docs: project instructions"

git checkout --quiet monthly-report
git -c user.name="BDK eval" -c user.email="eval@example.invalid" rebase --quiet main
NEW_BASE=$(git rev-parse main)
NEW_HEAD=$(git rev-parse HEAD)
sed -i.bak -e "s/$OLD_BASE/$NEW_BASE/g" -e "s/$OLD_HEAD/$NEW_HEAD/g" "$RECORD"
rm "$RECORD.bak"

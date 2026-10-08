#!/usr/bin/env bash
# tally-queue.sh with a different second entry: the Change 2-count-entries of issue 2, blocked by
# issue 1 (add-total), not started yet - no branch, no Change directory, no run files.
set -euo pipefail
bash "$(dirname "$0")/../fixtures/tally-queue.sh"

git branch --quiet -D add-count
rm -rf .bdk/runs/add-count
cat > .git/bdk-eval/issues/2.json <<'JSON'
{
  "number": 2,
  "title": "Count the entries of the ledger",
  "state": "OPEN",
  "url": "https://github.com/bdk-eval/repo/issues/2",
  "labels": [],
  "body": "## Goal\nA command that prints how many amounts the ledger holds, next to the total.\n\n## Dependencies\nBlocked by #1.",
  "blockedBy": { "nodes": [{ "number": 1, "state": "OPEN", "title": "Show the total of the ledger", "url": "https://github.com/bdk-eval/repo/issues/1" }] }
}
JSON
cat > .bdk/runs/run.json <<'JSON'
{
  "version": 1,
  "mode": "non-interactive",
  "base": "main",
  "queue": [
    { "change": "add-total", "issue": 1 },
    { "change": "2-count-entries", "issue": 2, "blocked-by": ["add-total"] }
  ],
  "current": "add-total"
}
JSON

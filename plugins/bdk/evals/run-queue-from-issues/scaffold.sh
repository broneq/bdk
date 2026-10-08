#!/usr/bin/env bash
# tiny-ledger configured for BDK on `main`, a bare `origin` inside the workspace, the offline gh
# stand-in, and two open issues: 1 (void entries in the balance) is blocked by 2 (void entries).
# No run yet. `policy.gates.design` is left at its default, manual, so the run stops at the gate.
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
bash "$here/../fixtures/tiny-ledger-bdk.sh"

git init --quiet --bare .git/bdk-eval/remote.git
git remote add origin ./.git/bdk-eval/remote.git
git config remote.origin.receivepack "$(git --exec-path)/git-receive-pack"
git push --quiet origin main
git fetch --quiet origin
git symbolic-ref refs/remotes/origin/HEAD refs/remotes/origin/main

mkdir -p .git/bdk-eval/bin .git/bdk-eval/issues
cp "$here/../fixtures/bin/gh" .git/bdk-eval/bin/gh
cat > .git/bdk-eval/issues/1.json <<'JSON'
{
  "number": 1,
  "title": "Leave void entries out of the balance",
  "state": "OPEN",
  "url": "https://github.com/bdk-eval/repo/issues/1",
  "labels": [],
  "body": "## Goal\n`balance(entries)` must skip entries marked void.\n\n## Acceptance signal\n- The balance of entries 5, -2 and a void 10 is 3.\n\n## Dependencies\nBlocked by #2.",
  "blockedBy": { "nodes": [{ "number": 2, "state": "OPEN", "title": "Mark an entry as void", "url": "https://github.com/bdk-eval/repo/issues/2" }] }
}
JSON
cat > .git/bdk-eval/issues/2.json <<'JSON'
{
  "number": 2,
  "title": "Mark an entry as void",
  "state": "OPEN",
  "url": "https://github.com/bdk-eval/repo/issues/2",
  "labels": [],
  "body": "## Goal\nAn entry can be marked void: `voidEntry(entry)` returns a copy of the entry with `void: true`; the entry passed in is not changed.\n\n## Acceptance signal\n- `voidEntry({ amount: 10 })` returns `{ amount: 10, void: true }`.\n\n## Dependencies\nNone.",
  "blockedBy": { "nodes": [] }
}
JSON

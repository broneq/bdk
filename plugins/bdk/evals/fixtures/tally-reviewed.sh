#!/usr/bin/env bash
# Shared fixture: tally-change.sh after review, ready to close. The branch `add-total` holds the
# Change `add-total` with conforming code; `origin` is a bare repository inside the workspace
# (.git/bdk-eval/remote.git) holding `main`, with `origin/HEAD` set, so `git push` works offline.
# The run files hold a review round without blockers and a passing E2E run, and the offline gh
# stand-in is copied to .git/bdk-eval/bin/gh. See ../README.md, "Shared fixtures".
set -euo pipefail

here="$(cd "$(dirname "$0")" && pwd)"
bash "$here/tally-change.sh"

git init --quiet --bare .git/bdk-eval/remote.git
git remote add origin ./.git/bdk-eval/remote.git
# A push to a local remote runs git-receive-pack. On a Mac without Homebrew git, /usr/bin's
# shims fail in the run's sandbox ("Host limits"), so name the real binary by its full path.
git config remote.origin.receivepack "$(git --exec-path)/git-receive-pack"
git push --quiet origin main
git fetch --quiet origin
git symbolic-ref refs/remotes/origin/HEAD refs/remotes/origin/main

mkdir -p .git/bdk-eval/bin
cp "$here/bin/gh" .git/bdk-eval/bin/gh

# Run files, as the earlier stages write them (ignored by git).
runs=.bdk/runs/add-total
mkdir -p "$runs/review/round-1/e2e"
: > "$runs/review/round-1/findings.jsonl"
cat > "$runs/review/round-1/review.md" <<'MD'
# Review round 1: add-total

No blockers. 0 findings.
MD

cat > "$runs/review/round-1/e2e/verdict.md" <<'MD'
Verdict: PASS

- pass: Total of added amounts - total-of-added-amounts.md
- pass: Empty ledger - empty-ledger.md
- pass: Help - help.md
- pass: Unknown command - unknown-command.md
MD
scenario() {
  cat > "$runs/review/round-1/e2e/$1.md" <<MD
Result: pass
Requirement: $2
Scenario: $3
Spec: openspec/changes/add-total/specs/tally/spec.md:$4
Item: cli (cli)

## Steps
1. $5

## Expected
$6

## Observed
$6
MD
}
scenario total-of-added-amounts Total "Total of added amounts" 7 '`tally add 5`, `tally add 2.5`, `tally total` in a fresh directory -> exit 0' '`Total: 7.50`, exit 0'
scenario empty-ledger Total "Empty ledger" 12 '`tally total` in a fresh directory -> exit 0' '`Total: 0.00`, exit 0'
scenario help Usage "Help" 23 '`tally --help` -> exit 0' '`usage: tally add <amount> | tally total`, exit 0'
scenario unknown-command Usage "Unknown command" 28 '`tally frobnicate` -> exit 2' 'the usage line, exit 2'

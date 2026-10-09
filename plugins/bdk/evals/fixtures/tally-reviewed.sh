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

## see-the-total
- pass: main (main, proposal.md:7) - see-the-total--main.md
- pass: empty-ledger (variant, proposal.md:7) - see-the-total--empty-ledger.md
- pass: repeated-total (break, proposal.md:7) - see-the-total--repeated-total.md

## read-the-usage
- pass: main (main, proposal.md:8) - read-the-usage--main.md
- pass: unknown-command (break, proposal.md:8) - read-the-usage--unknown-command.md

## Not a user process
- None.
MD
path() {
  cat > "$runs/review/round-1/e2e/$1--$2.md" <<MD
Result: pass
Process: $1
Path: $2 ($3)
Proposal: openspec/changes/add-total/proposal.md:$4 - $5
Item: cli (cli)

## Steps
1. $6

## Expected
$7

## Observed
$7
MD
}
total='New command `tally total`.'
usage='The usage line names `tally total`.'
path see-the-total main main 7 "$total" '`tally add 5`, `tally add 2.5`, `tally total` in a fresh directory -> exit 0' '`Total: 7.50`, exit 0'
path see-the-total empty-ledger variant 7 "$total" '`tally total` in a fresh directory -> exit 0' '`Total: 0.00`, exit 0'
path see-the-total repeated-total break 7 "$total" '`tally add 5`, `tally total`, `tally total` in a fresh directory -> exit 0 twice' '`Total: 5.00` both times, exit 0; the ledger still holds one amount'
path read-the-usage main main 8 "$usage" '`tally --help` -> exit 0' '`usage: tally add <amount> | tally total`, exit 0'
path read-the-usage unknown-command break 8 "$usage" '`tally frobnicate` -> exit 2' 'the usage line, exit 2'

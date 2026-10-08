#!/usr/bin/env bash
# Shared fixture, B1 size, queued: household-book-planned.sh made ready for an unattended
# plan-to-PR run by `/bdk:run` without arguments. Adds no commit: a bare `origin` inside the
# workspace (.git/bdk-eval/remote.git) holding `main`, a local git identity, the offline gh
# stand-in at .git/bdk-eval/bin/gh, .bdk/runs/run.json queueing add-household-book, and
# .bdk/settings.local.yaml with auto gates, decide-and-record questions and a foreground lead
# (`claude -p` stops a background lead 10 minutes after the main thread's last turn). Both files
# are ignored by git, so the tree stays clean. See ../README.md, "B1-sized fixture".
set -euo pipefail

here="$(cd "$(dirname "$0")" && pwd)"
bash "$here/household-book-planned.sh"

git init --quiet --bare .git/bdk-eval/remote.git
git remote add origin ./.git/bdk-eval/remote.git
# A push to a local remote runs git-receive-pack. On a Mac without Homebrew git, /usr/bin's
# shims fail in an eval run's sandbox (README "Host limits"), so name the real binary.
git config remote.origin.receivepack "$(git --exec-path)/git-receive-pack"
git push --quiet origin main
git fetch --quiet origin
git symbolic-ref refs/remotes/origin/HEAD refs/remotes/origin/main
# The run commits (the execute lead, close): a local identity, as a user's checkout has one.
git config user.name "BDK eval"
git config user.email "eval@example.invalid"

mkdir -p .git/bdk-eval/bin
cp "$here/bin/gh" .git/bdk-eval/bin/gh

cat > .bdk/settings.local.yaml <<'YAML'
# Unattended plan-to-PR run (B1-sized fixture, queued state).
policy:
  gates:
    design: auto
    review: auto
  questions: decide-and-record
execution:
  lead: foreground
YAML

cat > .bdk/runs/run.json <<'JSON'
{
  "version": 1,
  "mode": "non-interactive",
  "base": "main",
  "queue": [
    { "change": "add-household-book", "intent": "Grow ledger into a household book" }
  ],
  "current": "add-household-book"
}
JSON

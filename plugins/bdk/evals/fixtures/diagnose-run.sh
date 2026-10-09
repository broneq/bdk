#!/usr/bin/env bash
# Shared fixture: tally-bug.sh after one recorded `/bdk:debug` run of the crash (the `debug-fix`
# case, Claude Code 2.1.295). The branch `fix-total-crash` holds the run's two commits, the run
# files are in .bdk/runs/fix-total-crash/, and the session's transcripts, trimmed line for line by
# diagnose-run/trim.ts, are in .git/bdk-eval/transcripts/. See ../README.md, "Shared fixtures".
set -euo pipefail

here="$(cd "$(dirname "$0")" && pwd)"
bash "$here/tally-bug.sh"

cat > .bdk/settings.local.yaml <<'YAML'
policy:
  gates:
    design: auto
    review: auto
execution:
  lead: foreground
YAML

git checkout --quiet -b fix-total-crash
git am --quiet "$here"/diagnose-run/patches/*.patch

mkdir -p .bdk/runs .git/bdk-eval
cp -R "$here/diagnose-run/runs/fix-total-crash" .bdk/runs/
cp -R "$here/diagnose-run/transcripts" .git/bdk-eval/transcripts

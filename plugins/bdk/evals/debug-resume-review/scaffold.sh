#!/usr/bin/env bash
# The recorded debug-fix run of diagnose-run.sh, cut back to where execute ended: the diagnosis,
# the auto gate, the Change and the fix committed on fix-total-crash, execute/result.md with
# Status: done, and no review yet. Both gates auto and the lead in the foreground, as in debug-fix.
set -euo pipefail
bash "$(dirname "$0")/../fixtures/diagnose-run.sh"
run=.bdk/runs/fix-total-crash
rm -rf "$run/review" "$run/checks/round-1" "$run/checks/round-1.json" "$run/debug/result.md" .git/bdk-eval/transcripts

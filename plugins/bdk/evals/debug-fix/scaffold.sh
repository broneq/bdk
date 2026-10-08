#!/usr/bin/env bash
# tally-bug with both gates on auto and the lead in the foreground: claude -p stops background
# tasks 10 minutes after its last turn, and execute plus a review round take longer.
set -euo pipefail
bash "$(dirname "$0")/../fixtures/tally-bug.sh"
cat > .bdk/settings.local.yaml <<'YAML'
policy:
  gates:
    design: auto
    review: auto
execution:
  lead: foreground
YAML

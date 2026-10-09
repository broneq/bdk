#!/usr/bin/env bash
# add-total with round 1 triaged: one fix decision, a missing test of present behaviour (#346).
# Review gate auto, a budget of two rounds and a foreground lead, in the ignored local layer.
set -euo pipefail
bash "$(dirname "$0")/../fixtures/tally-total-untested.sh"
cat > .bdk/settings.local.yaml <<'YAML'
policy:
  gates:
    review: auto
  budgets:
    review-rounds: 2
# claude -p stops background tasks 10 minutes after its last turn; a round takes longer.
execution:
  lead: foreground
YAML

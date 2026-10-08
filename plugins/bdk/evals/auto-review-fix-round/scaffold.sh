#!/usr/bin/env bash
# monthly-report with round 1 judged (one finding of each level, no decision), review gate auto,
# a budget of two rounds (in the ignored local layer, so the tree stays clean and round 1's head
# stays HEAD), and a local git identity for the commits of the fix pass.
set -euo pipefail
bash "$(dirname "$0")/../fixtures/monthly-report-judged.sh"
git config user.name "BDK eval"
git config user.email "eval@example.invalid"
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

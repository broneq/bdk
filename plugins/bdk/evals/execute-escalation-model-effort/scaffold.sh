#!/usr/bin/env bash
set -euo pipefail
bash "$(dirname "$0")/../fixtures/ledger-totals-planned.sh"
cat > .bdk/settings.local.yaml <<'YAML'
models:
  conformer:
    effort: low
policy:
  budgets:
    part-attempts: 1
  escalation:
    model: sonnet
    effort: low
execution:
  lead: foreground
YAML

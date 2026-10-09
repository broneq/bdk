#!/usr/bin/env bash
set -euo pipefail
bash "$(dirname "$0")/../fixtures/ledger-change.sh"
cat > .bdk/settings.local.yaml <<'YAML'
models:
  planner:
    model: sonnet
    effort: low
  verifier:
    model: sonnet
    effort: medium
YAML

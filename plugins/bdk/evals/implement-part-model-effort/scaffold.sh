#!/usr/bin/env bash
set -euo pipefail
bash "$(dirname "$0")/../fixtures/ledger-planned.sh"
cat > .bdk/settings.local.yaml <<'YAML'
models:
  implementer:
    model: sonnet
    effort: low
YAML

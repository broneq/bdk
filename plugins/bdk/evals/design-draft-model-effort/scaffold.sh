#!/usr/bin/env bash
set -euo pipefail
bash "$(dirname "$0")/../fixtures/ledger-explored.sh"
cat > .bdk/settings.local.yaml <<'YAML'
models:
  designer:
    model: sonnet
    effort: high
policy:
  questions: decide-and-record
YAML

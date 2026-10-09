#!/usr/bin/env bash
# tally-change with models set in the ignored local layer, so the tree stays as the fixture leaves it.
set -euo pipefail
bash "$(dirname "$0")/../fixtures/tally-change.sh"
cat > .bdk/settings.local.yaml <<'YAML'
models:
  verifier:
    model: sonnet
YAML

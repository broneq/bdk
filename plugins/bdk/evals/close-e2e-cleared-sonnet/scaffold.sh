#!/usr/bin/env bash
# close-e2e-cleared on the subtler tester error of tally-e2e-cleared-stale.sh, with a sonnet
# verifier set in the ignored local layer (#402).
set -euo pipefail
bash "$(dirname "$0")/../fixtures/tally-e2e-cleared-stale.sh"
cat > .bdk/settings.local.yaml <<'YAML'
models:
  verifier:
    model: sonnet
YAML

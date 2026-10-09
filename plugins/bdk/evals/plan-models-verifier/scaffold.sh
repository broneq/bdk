#!/usr/bin/env bash
# ledger-change with models set in the ignored local layer, so the tree stays as the fixture leaves it.
set -euo pipefail
bash "$(dirname "$0")/../fixtures/ledger-change.sh"
cat > .bdk/settings.local.yaml <<'YAML'
models:
  verifier: sonnet
YAML

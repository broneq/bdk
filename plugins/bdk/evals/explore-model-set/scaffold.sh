#!/usr/bin/env bash
# ledger-proposal with models set in the ignored local layer, so the tree stays as the fixture leaves it.
set -euo pipefail
bash "$(dirname "$0")/../fixtures/ledger-proposal.sh"
cat > .bdk/settings.local.yaml <<'YAML'
models:
  explorer: sonnet
YAML

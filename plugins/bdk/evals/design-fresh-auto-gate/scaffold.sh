#!/usr/bin/env bash
set -euo pipefail
bash "$(dirname "$0")/../fixtures/ledger-proposal.sh"
cat >> .bdk/settings.yaml <<'YAML'
policy:
  questions: decide-and-record
  gates:
    design: auto
YAML

#!/usr/bin/env bash
set -euo pipefail
bash "$(dirname "$0")/../fixtures/ledger-explored.sh"
cat >> .bdk/settings.yaml <<'YAML'
policy:
  questions: decide-and-record
YAML

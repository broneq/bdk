#!/usr/bin/env bash
set -euo pipefail
bash "$(dirname "$0")/../fixtures/monthly-report-judged.sh"
cat >> .bdk/settings.yaml <<'YAML'
policy:
  gates:
    review: auto
YAML

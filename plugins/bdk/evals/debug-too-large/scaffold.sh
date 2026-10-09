#!/usr/bin/env bash
# tally-bug with plan parts limited to one file: the fix touches bin/tally.js and a test file, so
# it does not fit one part and diagnose-bug must report it too large. The design gate is auto, so
# a run that wrongly goes on is not stopped by a question but by the graders.
set -euo pipefail
bash "$(dirname "$0")/../fixtures/tally-bug.sh"
cat > .bdk/settings.local.yaml <<'YAML'
plan:
  part:
    max-files: 1
policy:
  gates:
    design: auto
YAML

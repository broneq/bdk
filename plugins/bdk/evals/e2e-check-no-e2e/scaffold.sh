#!/usr/bin/env bash
# The tally project without a tools.e2e entry: E2E has nothing to start.
set -euo pipefail
bash "$(dirname "$0")/../fixtures/tally-cli.sh"
cat > .bdk/settings.yaml <<'YAML'
# BDK project settings. Resolved values with their origins: bdk config show
languages: [javascript]
tools:
  test:
    - id: node-test
      command: npm test
YAML
git -c user.name="BDK eval" -c user.email="eval@example.invalid" commit --quiet -am "chore: no e2e entry"

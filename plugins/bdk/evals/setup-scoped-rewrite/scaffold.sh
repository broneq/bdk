#!/usr/bin/env bash
# tiny-ledger configured by an earlier BDK v3 whose test item still holds the removed `scoped`
# field, with a comment of the team in the settings. One more commit.
set -euo pipefail
bash "$(dirname "$0")/../fixtures/tiny-ledger-bdk.sh"
cat > .bdk/settings.yaml <<'YAML'
# BDK project settings. Resolved values with their origins: bdk config show
languages: [javascript]
tools:
  test:
    # The team's whole suite.
    - id: node-test
      command: npm test
      scoped: node --test {files}
YAML
git add .bdk/settings.yaml
git -c user.name="BDK eval" -c user.email="eval@example.invalid" commit --quiet -m "chore: BDK settings before check points"

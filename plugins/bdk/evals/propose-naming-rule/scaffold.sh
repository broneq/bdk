#!/usr/bin/env bash
# propose-from-issue plus a naming rule in openspec/config.yaml: Changes are named v3-<N>-<slug>.
set -euo pipefail
bash "$(dirname "$0")/../propose-from-issue/scaffold.sh"

cat >> openspec/config.yaml <<'YAML'

rules:
  proposal:
    - A change is named `v3-<N>-<slug>`, where N is the tracking issue number (e.g. v3-17-add-tags).
YAML
git add openspec/config.yaml
git -c user.name="BDK eval" -c user.email="eval@example.invalid" commit --quiet -m "chore: change naming rule"

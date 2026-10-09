#!/usr/bin/env bash
# The Change ready to plan plus a project rule of stage plan about the tasks of a part.
set -euo pipefail
bash "$(dirname "$0")/../fixtures/ledger-change.sh"
cat >> .bdk/settings.yaml <<'YAML'
rules:
  API-DOC-1:
    paths: ["src/**"]
    stages: [plan]
    text: >-
      A part that adds or changes a function exported from a module under `src/` ends with a
      task that documents the function in `docs/api.md`: its signature, what it returns and one
      example call. `docs/api.md` is in that part's `files`.
YAML
git add .
git -c user.name="BDK eval" -c user.email="eval@example.invalid" commit --quiet -m "chore: plan rule API-DOC-1"

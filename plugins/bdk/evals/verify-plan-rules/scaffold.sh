#!/usr/bin/env bash
# The planned Change plus a project rule of stage plan that part 01 (src/csv.js exports toCsv,
# no docs/api.md task) breaks and part 02 (bin/, package.json) is out of; committed.
set -euo pipefail
bash "$(dirname "$0")/../fixtures/ledger-planned.sh"
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

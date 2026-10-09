#!/usr/bin/env bash
# The explored Change plus a project rule of stage design, kept in a team convention document
# that the settings point to; the proposal does not hint at it.
set -euo pipefail
bash "$(dirname "$0")/../fixtures/ledger-explored.sh"
cat >> .bdk/settings.yaml <<'YAML'
policy:
  questions: decide-and-record
rules:
  IO-1:
    stages: [design]
    file: docs/conventions/io.md
YAML
mkdir -p docs/conventions
cat > docs/conventions/io.md <<'MD'
---
owner: platform team
---

Every module that reads or writes a file format (CSV, JSON, ...) lives in `src/io/`, one module
per format named after it (`src/io/csv.js`). Code outside `src/io/` builds no format text; it
calls these modules.
MD

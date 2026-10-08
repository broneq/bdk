#!/usr/bin/env bash
# The planned B1-sized fixture without its plan report, so the run writes verify-1.md.
set -euo pipefail
bash "$(dirname "$0")/../fixtures/household-book-planned.sh"
rm -r .bdk/runs/add-household-book/plan

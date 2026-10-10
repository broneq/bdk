#!/usr/bin/env bash
# The Change count-entries (MODIFIES Total and Usage, 5 scenarios, 3 already true in the code), no plan.
set -euo pipefail
bash "$(dirname "$0")/../fixtures/tally-modified.sh"

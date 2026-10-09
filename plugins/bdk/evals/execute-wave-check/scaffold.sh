#!/usr/bin/env bash
# Resume after both parts of wave 1 were built and committed, before the wave check ran: the
# implementer of part 02 can foresee part 01's rule and date its test, so a run from the plan does
# not reliably reach the red wave check this case grades.
set -euo pipefail
bash "$(dirname "$0")/../fixtures/ledger-dated-merged.sh"
rm -r .bdk/runs/dated-entries/checks

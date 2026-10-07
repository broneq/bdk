#!/usr/bin/env bash
# Nothing staged: a README typo fix and an unrelated off-by-one fix in the due date.
set -euo pipefail
bash "$(dirname "$0")/../fixtures/shop-repo.sh"

sed -i.bak 's/runing/running/' README.md && rm README.md.bak
sed -i.bak 's/(termDays - 1) \* DAY_MS/termDays * DAY_MS/' src/billing/invoice.js && rm src/billing/invoice.js.bak

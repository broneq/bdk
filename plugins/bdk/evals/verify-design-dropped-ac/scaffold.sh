#!/usr/bin/env bash
# The design leaves AC-4 out as "Decided without the user"; the scope log holds no entry for it.
set -euo pipefail
bash "$(dirname "$0")/../fixtures/ledger-acceptance.sh"

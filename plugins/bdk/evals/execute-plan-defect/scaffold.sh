#!/usr/bin/env bash
# The shared plan, with task 1 of part 02 returning the expenses negative while its
# scenario expects 9 for amounts 5, -2 and -7.
set -euo pipefail
bash "$(dirname "$0")/../fixtures/ledger-totals-planned.sh"
part=openspec/changes/add-totals/plan/parts/02.md
sed -i.bak 's/returning the sum of the negative amounts negated/returning the sum of the negative amounts unchanged, so 5, -2 and -7 give -9/' "$part"
rm "$part.bak"
git commit --quiet -am "docs: expenses stay negative"

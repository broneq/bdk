#!/usr/bin/env bash
# The shared plan built as the execute lead leaves it before merging part 02: both parts
# committed on their branches with done reports, part 01 merged into the Change branch
# add-totals, and the merge of part 02 stopped on the conflict in src/ledger.js.
set -euo pipefail
bash "$(dirname "$0")/../fixtures/ledger-totals-planned.sh"

git switch --quiet -c add-totals

git switch --quiet -c bdk/add-totals/part-01 add-totals
cat >> src/ledger.js <<'JS'

export function income(entries) {
  return entries.reduce((sum, entry) => (entry.amount > 0 ? sum + entry.amount : sum), 0);
}
JS
cat > src/income.test.js <<'JS'
import { test } from "node:test";
import assert from "node:assert/strict";
import { income } from "./ledger.js";

test("Income of mixed entries", () => {
  assert.equal(income([{ amount: 5 }, { amount: -2 }, { amount: 3 }]), 8);
});

test("No income", () => {
  assert.equal(income([]), 0);
});
JS
git add .
git commit --quiet -m "feat(ledger): income total (part 01)"

git switch --quiet -c bdk/add-totals/part-02 add-totals
cat >> src/ledger.js <<'JS'

export function expenses(entries) {
  return entries.reduce((sum, entry) => (entry.amount < 0 ? sum - entry.amount : sum), 0);
}
JS
cat > src/expenses.test.js <<'JS'
import { test } from "node:test";
import assert from "node:assert/strict";
import { expenses } from "./ledger.js";

test("Expenses of mixed entries", () => {
  assert.equal(expenses([{ amount: 5 }, { amount: -2 }, { amount: -7 }]), 9);
});

test("No expenses", () => {
  assert.equal(expenses([{ amount: 5 }, { amount: 3 }]), 0);
});
JS
git add .
git commit --quiet -m "feat(ledger): expense total (part 02)"

git switch --quiet add-totals
git merge --quiet --no-ff --no-edit bdk/add-totals/part-01
if git merge --no-ff --no-edit bdk/add-totals/part-02 >/dev/null 2>&1; then
  echo "expected a merge conflict" >&2
  exit 1
fi

run=.bdk/runs/add-totals/execute
mkdir -p "$run"
for part in 01 02; do
  printf 'Status: done\n\n## Acceptance tests\n- see the part\n\n## Changed files\n- src/ledger.js\n\n## Checks\n- checks/%s.json: pass\n\n## Decisions taken without the user\n- None.\n' "$part" > "$run/part-$part.md"
  printf 'Verdict: PASS\n\n## Fixed\n- None.\n\n## Left\n- None.\n\n## Checks\n- checks/conform-%s.json: pass\n' "$part" > "$run/conform-$part.md"
done

#!/usr/bin/env bash
# Shared fixture: ledger-dated-planned.sh after the execute lead built both parts of wave 1 on
# the Change branch dated-entries, each green alone, and ran the wave check: `npm test` fails
# because the test of src/report.js builds entries without a date, which balance() now rejects.
# state.json records the wave's base, and checks/wave-1.json the red check, as `bdk check run`
# writes them. See ../README.md.
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
bash "$here/ledger-dated-planned.sh"

git switch --quiet -c dated-entries
base="$(git rev-parse HEAD)"

cat > src/ledger.js <<'JS'
export function balance(entries) {
  entries.forEach((entry, index) => {
    if (typeof entry.date !== "string") throw new TypeError(`entry ${index + 1} has no date`);
  });
  return entries.reduce((sum, entry) => sum + entry.amount, 0);
}
JS
cat > src/ledger.test.js <<'JS'
import { test } from "node:test";
import assert from "node:assert/strict";
import { balance } from "./ledger.js";

test("balance sums the amounts", () => {
  assert.equal(
    balance([
      { amount: 5, date: "2026-10-01" },
      { amount: -2, date: "2026-10-02" },
    ]),
    3,
  );
});

test("Entry without a date", () => {
  assert.throws(() => balance([{ amount: 5 }]), { name: "TypeError", message: /entry 1/ });
});
JS
git add .
git commit --quiet -m "feat(ledger): reject an entry without a date (part 01)"

git switch --quiet --detach "$base"
cat > src/report.js <<'JS'
import { balance } from "./ledger.js";

export function summary(entries) {
  return `Balance: ${balance(entries)}`;
}
JS
cat > src/report.test.js <<'JS'
import { test } from "node:test";
import assert from "node:assert/strict";
import { summary } from "./report.js";

test("Summary of income and an expense", () => {
  assert.equal(summary([{ amount: 5 }, { amount: -2 }]), "Balance: 3");
});
JS
git add .
git commit --quiet -m "feat(report): summary line (part 02)"
part02="$(git rev-parse HEAD)"
git switch --quiet dated-entries
git cherry-pick "$part02" >/dev/null

run=.bdk/runs/dated-entries
mkdir -p "$run/execute" "$run/checks/wave-1"
for part in 01 02; do
  printf 'Status: done\n\n## Acceptance tests\n- see the part\n\n## Changed files\n- see the part\n\n## Checks\n- checks/%s.json: pass\n\n## Decisions taken without the user\n- None.\n' "$part" > "$run/execute/part-$part.md"
  printf 'Verdict: PASS\n\n## Fixed\n- None.\n\n## Left\n- None.\n\n## Checks\n- checks/%s.json: pass, unchanged\n' "$part" > "$run/execute/conform-$part.md"
done
cat > "$run/state.json" <<JSON
{"version":1,"parts":{"01":{"status":"done","attempts":1},"02":{"status":"done","attempts":1}},"waves":{"1":{"base":"$base","status":"pending"}}}
JSON

output="$run/checks/wave-1/test-node-test.txt"
npm test > "$output" 2>&1 && { echo "expected the wave check to fail" >&2; exit 1; }
echo "exit 1" >> "$output"
tail_json="$(grep -v '^exit 1$' "$output" | tail -n 20 | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>process.stdout.write(JSON.stringify(s.replace(/\n$/,"").split("\n"))))')"
cat > "$run/checks/wave-1.json" <<JSON
{"version":2,"id":"wave-1","at":"wave","changed":"$base","scope":["src/ledger.js","src/ledger.test.js","src/report.js","src/report.test.js"],"verdict":"fail","checks":[{"kind":"test","tool":"node-test","command":"npm test","scoped":false,"status":"fail","exit":1,"timeout":600,"output":"$output","tail":$tail_json}],"skipped":[],"findings":null}
JSON

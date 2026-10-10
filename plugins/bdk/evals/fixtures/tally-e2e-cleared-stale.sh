#!/usr/bin/env bash
# Shared fixture: tally-e2e-cleared.sh with a subtler tester error (#402). The failed path
# `see-the-total--empty-ledger.md` observed `Total: 7.50`, exit 0: output the code gives, but for
# the ledger the `main` path left (`tally add 5`, `tally add 2.5`) in the directory the tester
# reused, not for a fresh one, where bin/tally.js prints `Total: 0.00`. No missing string refutes
# it; only the path's input does. The round's judge levelled its finding `not-a-problem`.
# See ../README.md, "Shared fixtures".
set -euo pipefail
bash "$(dirname "$0")/tally-e2e-cleared.sh"

round=.bdk/runs/add-total/review/round-1
cat > "$round/e2e/see-the-total--empty-ledger.md" <<'MD'
Result: fail
Process: see-the-total
Path: empty-ledger (variant)
Proposal: openspec/changes/add-total/proposal.md:7 - New command `tally total`.
Item: cli (cli)

## Steps
1. `node /work/tally/bin/tally.js total` with no ledger -> exit 0, stdout `Total: 7.50`

## Expected
`Total: 0.00`, exit 0
Expected from: openspec/changes/add-total/specs/tally/spec.md:12

## Observed
exit 0, stdout `Total: 7.50`: total reports amounts although no ledger was written on this path
MD

node -e '
const fs = require("node:fs");
const file = process.argv[1];
const lines = fs.readFileSync(file, "utf8").trimEnd().split("\n").map((line) => JSON.parse(line));
const finding = lines.find((l) => l.type === "finding" && l.id === "f-4d2e8a1c7b90");
const level = lines.find((l) => l.type === "level" && l.id === "f-4d2e8a1c7b90");
if (!finding || !level) throw new Error("fixture changed: no empty-ledger finding");
finding.summary = "see-the-total / empty-ledger: tally total prints Total: 7.50 with no ledger written on the path";
finding.evidence = ".bdk/runs/add-total/review/round-1/e2e/see-the-total--empty-ledger.md: expected `Total: 0.00`, exit 0 (specs/tally/spec.md:12); observed exit 0, stdout `Total: 7.50`";
level.reason = "The observation does not hold for the path input: with no ledger.json, load() at bin/tally.js:10 returns [] and total prints Total: 0.00. Total: 7.50 is the sum of the ledger the main path writes (tally add 5, tally add 2.5), so the tester ran in that directory, not a fresh one.";
fs.writeFileSync(file, lines.map((l) => JSON.stringify(l)).join("\n") + "\n");
' "$round/findings.jsonl"

#!/usr/bin/env bash
# Fix part 01 built and left uncommitted: the delta gains the requirement Bad amount, and the
# implementer's report says done with no acceptance test (the part changes spec text only).
set -euo pipefail
bash "$(dirname "$0")/../fixtures/tally-spec-fix-part.sh"
node -e '
const fs = require("node:fs");
const file = "openspec/changes/add-total/specs/tally/spec.md";
const text = fs.readFileSync(file, "utf8");
const at = text.indexOf("\n## MODIFIED Requirements");
if (at < 0) throw new Error("fixture changed: no MODIFIED section");
const added = "\n### Requirement: Bad amount\n\n`tally add` SHALL refuse an amount that is not a number: it SHALL print `tally: not an amount: <text>` to stderr, exit 1 and leave the ledger unchanged.\n\n#### Scenario: Amount that is not a number\n\n- **WHEN** `tally add abc` runs\n- **THEN** it prints `tally: not an amount: abc` to stderr, exits 1, and the ledger is unchanged\n";
fs.writeFileSync(file, text.slice(0, at) + added + text.slice(at));
'
mkdir -p .bdk/runs/add-total/execute
cat > .bdk/runs/add-total/execute/part-01.md <<'MD'
Status: done

## Acceptance tests
- None.

## Changed files
- openspec/changes/add-total/specs/tally/spec.md

## Checks
- None.

## Decisions taken without the user
- Task 1 changes spec text only: no test, its check is the spec check of the next review round.
MD

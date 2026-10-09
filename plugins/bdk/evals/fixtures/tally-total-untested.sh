#!/usr/bin/env bash
# Shared fixture: tally-change.sh with the BDK schema, plan part 01 of `add-total` built and
# committed, and review round 1 judged and triaged (#346). The code already does the scenario
# "Empty ledger" (`tally total` prints `Total: 0.00` without a ledger), but the only total test
# covers "Total of added amounts": round 1 holds one should-fix finding "scenario Empty ledger
# has no test", decided fix, as a review that asks for a test of present behaviour leaves it.
# A local git identity for the commits of a fix pass. See ../README.md, "Shared fixtures".
set -euo pipefail

here="$(cd "$(dirname "$0")" && pwd)"
bash "$here/tally-change.sh"
git config user.name "BDK eval"
git config user.email "eval@example.invalid"

# The BDK schema on main, as /bdk:setup leaves it, so round 1 reviews only the Change.
git checkout --quiet main
mkdir -p openspec/schemas
cp -R "$here/../../openspec/schemas/bdk" openspec/schemas/bdk
printf 'schema: bdk\n' > openspec/config.yaml
git add .
git commit --quiet -m "chore: bdk schema"
git checkout --quiet add-total
git rebase --quiet main
printf 'schema: bdk\ncreated: 2026-10-01\n' > openspec/changes/add-total/.openspec.yaml

mkdir -p openspec/changes/add-total/plan/parts
cat > openspec/changes/add-total/plan/parts/01.md <<'MD'
---
id: "01"
depends-on: []
isolation: shared
files:
  - bin/tally.js
  - test/total.test.js
---

# Part 01: Total command

## Goal

`tally total` prints the sum of the ledger, and the usage line names it.

## Acceptance scenarios

- `tally` / Requirement: Total / Scenario: Total of added amounts
- `tally` / Requirement: Total / Scenario: Empty ledger
- `tally` / Requirement: Usage / Scenario: Help

## Tasks

1. Add the command `tally total`
   - File: bin/tally.js, test/total.test.js
   - Interface: tally total (CLI), prints `Total: <sum with two decimals>`, exit 0
   - Verified by: tally / Requirement: Total / Scenario: Total of added amounts; test/total.test.js
2. Name `tally total` in the usage line
   - File: bin/tally.js
   - Interface: USAGE = "usage: tally add <amount> | tally total"
   - Verified by: tally / Requirement: Usage / Scenario: Help
MD

cat > test/total.test.js <<'JS'
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const tally = join(import.meta.dirname, "..", "bin", "tally.js");

test("total of added amounts", () => {
  const cwd = mkdtempSync(join(tmpdir(), "tally-"));
  execFileSync("node", [tally, "add", "5"], { cwd });
  execFileSync("node", [tally, "add", "2.5"], { cwd });
  assert.equal(execFileSync("node", [tally, "total"], { cwd, encoding: "utf8" }), "Total: 7.50\n");
});
JS
git add .
git commit --quiet -m "test: total of added amounts"

# Round 1 as `bdk git groups main --plan openspec/changes/add-total/plan/parts --record <round>`,
# `bdk findings add/level/decide` and `bdk findings report` record it.
ROUND=.bdk/runs/add-total/review/round-1
BASE=$(git rev-parse main)
HEAD=$(git rev-parse HEAD)
mkdir -p "$ROUND"
cat > "$ROUND/groups.json" <<JSON
{"base":"main","anchor":{"kind":"base","sha":"$BASE"},"head":"$HEAD","range":"$BASE..$HEAD","files":["bin/tally.js","openspec/changes/add-total/.openspec.yaml","openspec/changes/add-total/plan/parts/01.md","openspec/changes/add-total/proposal.md","openspec/changes/add-total/specs/tally/spec.md","test/total.test.js"],"binary":[],"deleted":[],"dirty":[],"groups":[{"id":"p01","kind":"part","part":"01","files":["bin/tally.js","test/total.test.js"]},{"id":"unplanned","kind":"unplanned","files":["openspec/changes/add-total/.openspec.yaml","openspec/changes/add-total/plan/parts/01.md","openspec/changes/add-total/proposal.md","openspec/changes/add-total/specs/tally/spec.md"]},{"id":"integration","kind":"integration","files":["bin/tally.js","openspec/changes/add-total/.openspec.yaml","openspec/changes/add-total/plan/parts/01.md","openspec/changes/add-total/proposal.md","openspec/changes/add-total/specs/tally/spec.md","test/total.test.js"]}]}
JSON
cat > "$ROUND/findings.jsonl" <<'JSONL'
{"type":"finding","id":"f-86d92ef246f3","source":"review-group","summary":"Spec scenario Empty ledger has no test","file":"test/total.test.js","line":10,"evidence":"Part 01 lists the scenario 'Empty ledger' (tally total in a directory without a ledger prints 'Total: 0.00', exit 0) as an acceptance scenario, but test/total.test.js only covers 'Total of added amounts'; nothing guards the empty case."}
{"type":"level","id":"f-86d92ef246f3","level":"should-fix","reason":"An acceptance scenario of the Change has no test."}
{"type":"decision","id":"f-86d92ef246f3","decision":"fix","reason":"policy.gates.review auto: should-fix"}
JSONL
cat > "$ROUND/review.md" <<'MD'
# Review round report

1 findings. Level: 0 blocker, 1 should-fix, 0 nice-to-have, 0 not-a-problem, 0 unleveled. Decision: 1 fix, 0 accept, 0 defer, 0 undecided.

## blocker

None.

## should-fix

- f-86d92ef246f3 `test/total.test.js:10` Spec scenario Empty ledger has no test (review-group)
  - Evidence: Part 01 lists the scenario 'Empty ledger' (tally total in a directory without a ledger prints 'Total: 0.00', exit 0) as an acceptance scenario, but test/total.test.js only covers 'Total of added amounts'; nothing guards the empty case.
  - Level reason: An acceptance scenario of the Change has no test.
  - Decision: fix
  - Decision reason: policy.gates.review auto: should-fix

## nice-to-have

None.

## not-a-problem

None.

## unleveled

None.
MD

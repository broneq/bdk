#!/usr/bin/env bash
# Shared fixture: tally-reviewed.sh plus a second reviewed Change of the same queue. The branch
# `add-count`, made from `main`, holds the Change `add-count` (ADDED Count, MODIFIED Usage) with
# conforming code and a review round without blockers. Issues 1 (add-total) and 2 (add-count)
# are in the offline gh stand-in's store, and .bdk/runs/run.json queues both Changes on the base
# `main`, `current` add-total. `add-total` is checked out. See ../README.md, "Shared fixtures".
set -euo pipefail

here="$(cd "$(dirname "$0")" && pwd)"
bash "$here/tally-reviewed.sh"

commit() {
  git add .
  git -c user.name="BDK eval" -c user.email="eval@example.invalid" commit --quiet -m "$1"
}

# The records of the stages before review, so `bdk run status` puts a Change at `close`: a
# design.md and one plan part in the Change (committed on its branch), and the passing reports,
# the design gate and the done part in its run directory (ignored by git).
stages_done() {
  local change="$1" what="$2" runs=".bdk/runs/$1"
  mkdir -p "openspec/changes/$change/plan/parts"
  cat > "openspec/changes/$change/design.md" <<MD
## Context

$what: one more branch of the command switch in \`bin/tally.js\`.

## Decisions

- Read the ledger with the existing \`load()\`; no new module.
MD
  cat > "openspec/changes/$change/plan/parts/01.md" <<MD
---
id: "01"
depends-on: []
isolation: shared
files: [bin/tally.js]
---

## Tasks

1. $what
   - File: bin/tally.js
   - Interface: tally CLI
   - Verified by: the scenarios of the Change
MD
  commit "docs: design and plan of $change"
  mkdir -p "$runs/design" "$runs/plan"
  printf 'Verdict: PASS\n' > "$runs/design/verify-1.md"
  printf 'Gate: approved\nBy: user\nReport: design/verify-1.md\n' > "$runs/design/gate.md"
  printf 'Verdict: PASS\n' > "$runs/plan/verify-1.md"
  printf '{ "version": 1, "parts": { "01": { "status": "done", "attempts": 1 } } }\n' > "$runs/state.json"
}

stages_done add-total "Add the command \`tally total\`"

git checkout --quiet main
git checkout --quiet -b add-count

cat > bin/tally.js <<'JS'
#!/usr/bin/env node
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { parseAmount } from "../src/parse.js";

const FILE = "ledger.json";
const USAGE = "usage: tally add <amount> | tally count";
const [command, value] = process.argv.slice(2);

function load() {
  return existsSync(FILE) ? JSON.parse(readFileSync(FILE, "utf8")) : [];
}

if (command === "add") {
  const amount = parseAmount(value);
  writeFileSync(FILE, JSON.stringify([...load(), amount]));
  console.log(`Added ${amount.toFixed(2)}`);
} else if (command === "count") {
  console.log(`Entries: ${load().length}`);
} else {
  console.log(USAGE);
  process.exit(command === "--help" ? 0 : 2);
}
JS

mkdir -p openspec/changes/add-count/specs/tally
cat > openspec/changes/add-count/.openspec.yaml <<'YAML'
schema: spec-driven
created: 2026-10-01
YAML

cat > openspec/changes/add-count/proposal.md <<'MD'
## Why

Users want to know how many amounts the ledger holds.

## What Changes

- New command `tally count`.
- The usage line names `tally count`.

## Capabilities

### Modified Capabilities
- `tally`: new requirement Count; Usage names the new command.
MD

cat > openspec/changes/add-count/specs/tally/spec.md <<'MD'
## ADDED Requirements

### Requirement: Count

`tally count` SHALL print the number of amounts in the ledger of the current directory as `Entries: <number>` and exit 0.

#### Scenario: Count of added amounts

- **WHEN** `tally add 5` and `tally add 2.5` ran in a directory
- **THEN** `tally count` in that directory prints `Entries: 2` and exits 0

#### Scenario: Empty ledger

- **WHEN** no amount was added in a directory
- **THEN** `tally count` in that directory prints `Entries: 0` and exits 0

## MODIFIED Requirements

### Requirement: Usage

`tally --help` SHALL print the usage line and exit 0; any unknown command SHALL print the usage line and exit 2. The usage line SHALL name both commands.

#### Scenario: Help

- **WHEN** `tally --help` runs
- **THEN** it prints `usage: tally add <amount> | tally count` and exits 0

#### Scenario: Unknown command

- **WHEN** `tally frobnicate` runs
- **THEN** it prints the usage line and exits 2
MD

commit "feat: tally count"
stages_done add-count "Add the command \`tally count\`"

# Run files of add-count, as the earlier stages write them (ignored by git).
runs=.bdk/runs/add-count
mkdir -p "$runs/review/round-1"
: > "$runs/review/round-1/findings.jsonl"
cat > "$runs/review/round-1/review.md" <<'MD'
# Review round 1: add-count

No blockers. 0 findings.
MD

git checkout --quiet add-total

issue() {
  cat > ".git/bdk-eval/issues/$1.json" <<JSON
{
  "number": $1,
  "title": "$2",
  "state": "OPEN",
  "url": "https://github.com/bdk-eval/repo/issues/$1",
  "labels": [],
  "body": "## Goal\n$3",
  "blockedBy": { "nodes": [] }
}
JSON
}
mkdir -p .git/bdk-eval/issues
issue 1 "Show the total of the ledger" "A command that prints the sum of the amounts."
issue 2 "Count the entries of the ledger" "A command that prints how many amounts the ledger holds."

cat > .bdk/runs/run.json <<'JSON'
{
  "version": 1,
  "mode": "non-interactive",
  "base": "main",
  "queue": [
    { "change": "add-total", "issue": 1 },
    { "change": "add-count", "issue": 2 }
  ],
  "current": "add-total"
}
JSON

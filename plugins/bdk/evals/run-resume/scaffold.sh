#!/usr/bin/env bash
# tally-queue.sh broken off in the close of its second Change: add-total is closed (archived,
# committed, pushed, PR 1, close/pr.md); add-count passed spec-conformance and is archived and
# committed, but not pushed. `current` is add-count, which is checked out.
set -euo pipefail
bash "$(dirname "$0")/../fixtures/tally-queue.sh"

commit() {
  git add -A
  git -c user.name="BDK eval" -c user.email="eval@example.invalid" commit --quiet -m "$1"
}

# What `openspec archive` leaves: the Change under archive/ and its deltas in the main spec.
archive() {
  local change="$1" requirement="$2" command="$3" sample="$4"
  git mv "openspec/changes/$change" "openspec/changes/archive/2026-10-08-$change"
  cat > openspec/specs/tally/spec.md <<MD
# tally Specification

## Purpose
\`tally\` adds up amounts in a ledger file (\`ledger.json\`) in the current directory.

## Requirements

### Requirement: Add

\`tally add <amount>\` SHALL append the amount to the ledger of the current directory, creating it when missing, and print \`Added <amount with two decimals>\`.

#### Scenario: First amount

- **WHEN** \`tally add 5\` runs in a directory without a ledger
- **THEN** it prints \`Added 5.00\` and the ledger holds 5

### Requirement: Usage

\`tally --help\` SHALL print the usage line and exit 0; any unknown command SHALL print the usage line and exit 2. The usage line SHALL name both commands.

#### Scenario: Help

- **WHEN** \`tally --help\` runs
- **THEN** it prints \`usage: tally add <amount> | tally $command\` and exits 0

#### Scenario: Unknown command

- **WHEN** \`tally frobnicate\` runs
- **THEN** it prints the usage line and exits 2

### Requirement: $requirement

$sample
MD
  commit "chore: archive $change"
  mkdir -p ".bdk/runs/$change/close"
  printf 'Verdict: PASS\n\nNo findings.\n' > ".bdk/runs/$change/close/spec-conformance.md"
}

archive add-total Total total "\`tally total\` SHALL print the sum of the amounts in the ledger as \`Total: <sum with two decimals>\` and exit 0.

#### Scenario: Empty ledger

- **WHEN** no amount was added in a directory
- **THEN** \`tally total\` prints \`Total: 0.00\` and exits 0"
git push --quiet -u origin add-total
mkdir -p .git/bdk-eval/prs
cat > .git/bdk-eval/prs/1.json <<'JSON'
{
  "number": 1,
  "url": "https://github.com/bdk-eval/repo/pull/1",
  "state": "OPEN",
  "baseRefName": "main",
  "headRefName": "add-total",
  "title": "feat: tally total",
  "body": "Adds `tally total`.\n\nResolves #1"
}
JSON
cat > .bdk/runs/add-total/close/pr.md <<'MD'
PR: https://github.com/bdk-eval/repo/pull/1
Base: main
Branch: add-total

Adds `tally total`.

Resolves #1
MD

git checkout --quiet add-count
archive add-count Count count "\`tally count\` SHALL print the number of amounts in the ledger as \`Entries: <number>\` and exit 0.

#### Scenario: Empty ledger

- **WHEN** no amount was added in a directory
- **THEN** \`tally count\` prints \`Entries: 0\` and exits 0"

node -e '
const fs = require("node:fs");
const file = ".bdk/runs/run.json";
const run = JSON.parse(fs.readFileSync(file, "utf8"));
run.current = "add-count";
fs.writeFileSync(file, JSON.stringify(run, null, 2) + "\n");
'

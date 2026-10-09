#!/usr/bin/env bash
# The ledger CLI of setup-node-cli, upgraded from BDK v2: .gitignore holds the v2 /.bdk/ rule, and
# the project runs its own OpenSpec Changes on the stock spec-driven schema. One more commit.
set -euo pipefail
bash "$(dirname "$0")/../setup-node-cli/scaffold.sh"

printf 'node_modules/\n/.bdk/\n' > .gitignore

mkdir -p openspec/specs/ledger openspec/changes/archive
touch openspec/changes/archive/.gitkeep
cat > openspec/config.yaml <<'YAML'
schema: spec-driven

context: |
  ledger-cli sums ledger files. This repository runs its Changes on the stock
  spec-driven schema.
YAML
cat > openspec/specs/ledger/spec.md <<'MD'
# ledger Specification

## Purpose

Summing the amounts of a ledger file.

## Requirements

### Requirement: Sum

`ledger sum <file>` SHALL print the sum of the second column.

#### Scenario: Two entries

- **WHEN** the file holds `rent,-5` and `pay,7`
- **THEN** `ledger sum` prints `2`
MD

git add .
git -c user.name="BDK eval" -c user.email="eval@example.invalid" commit --quiet -m "chore: openspec and the v2 ignore rule"

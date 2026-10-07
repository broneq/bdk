#!/usr/bin/env bash
# An OpenSpec project whose archived Change add-export decided, in D2, to stream the CSV.
set -euo pipefail
bash "$(dirname "$0")/../fixtures/tiny-ledger.sh"
change=openspec/changes/archive/2026-09-14-add-export
mkdir -p "$change" openspec/specs
cat > openspec/config.yaml <<'YAML'
schema: spec-driven
YAML
cat > "$change/proposal.md" <<'MD'
# Proposal

## Why

Accountants need the ledger entries of a period as a CSV file for their own tools.

## What Changes

- New endpoint `GET /entries/export?from=&to=` returning `text/csv`.
MD
cat > "$change/design.md" <<'MD'
# Design

## Context

The largest customer holds about 2 million ledger entries; the API runs in containers
with 512 MB of memory.

## Decisions

### D1. CSV, not XLSX

Every accounting tool our customers named reads CSV. XLSX needs a library and gives
nothing they asked for.

### D2. Stream the export row by row

The endpoint reads entries through a database cursor and writes each row to the
response as it is read, so memory stays flat whatever the period holds.

Alternatives:

- _Build the whole file in memory, then send it:_ 2 million rows are about 300 MB of
  CSV text; with the 512 MB container limit a large export kills the process. Lost.
- _A background job that e-mails a download link:_ needs a job queue, file storage and
  mail delivery, none of which the product has; the user also waits for an e-mail
  instead of a download. Lost.

### D3. Dates in ISO 8601

Unambiguous across locales.
MD

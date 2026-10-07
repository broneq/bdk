#!/usr/bin/env bash
# A project with seven decision records in doc/decisions/, in the adr-tools (Nygard) format;
# record 4 accepted polling for notifications.
set -euo pipefail
bash "$(dirname "$0")/../fixtures/tiny-ledger.sh"
mkdir -p doc/decisions

record() {
  local file=$1 number=$2 title=$3 date=$4 context=$5 decision=$6 consequences=$7
  cat > "doc/decisions/$file" <<MD
# $number. $title

Date: $date

## Status

Accepted

## Context

$context

## Decision

$decision

## Consequences

$consequences
MD
}

record 0001-record-architecture-decisions.md 1 "Record architecture decisions" 2025-01-06 \
  "We need to record the architectural decisions made on this project." \
  "We will use Architecture Decision Records, as described by Michael Nygard." \
  "See Michael Nygard's article for a description of the format."
record 0002-use-postgresql.md 2 "Use PostgreSQL" 2025-01-13 \
  "We need one relational store for orders, users and notifications." \
  "We will use PostgreSQL 16." \
  "One database to run and back up; JSON columns cover the few loose fields."
record 0003-rest-api-with-openapi.md 3 "REST API described with OpenAPI" 2025-02-03 \
  "The web and mobile clients need one API contract." \
  "We will expose a REST API and describe it in openapi.yaml." \
  "Clients are generated from the contract; breaking changes need a new version."
record 0004-poll-for-notifications.md 4 "Poll for notifications" 2025-03-02 \
  "Users need to see new in-app notifications without reloading the page." \
  "The web client polls GET /notifications every 15 seconds." \
  "Simple to build behind the existing REST API; traffic grows with the number of open tabs."
record 0005-nginx-reverse-proxy.md 5 "nginx as the reverse proxy" 2025-03-20 \
  "The API and the static web client are served from one host." \
  "nginx terminates TLS and proxies /api to the Node service." \
  "One proxy configuration to maintain; connection upgrades are not configured."
record 0006-feature-flags-in-database.md 6 "Feature flags in the database" 2025-05-11 \
  "We want to turn features on per customer without a deploy." \
  "Feature flags live in a PostgreSQL table read at request time." \
  "No external flag service; flags are cached for 30 seconds."
record 0007-structured-logging.md 7 "Structured JSON logging" 2025-06-30 \
  "Logs from several services must be searchable together." \
  "Every service logs one JSON object per line with a request id." \
  "Log lines are larger; the log store can index fields."

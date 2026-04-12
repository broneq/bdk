#!/usr/bin/env bash
# Ensure required project directories exist before file writes.
# Add new directories here as needed.

REQUIRED_DIRS=(
    "docs/cr"
    "docs/plans"
    "docs/progress"
)

for dir in "${REQUIRED_DIRS[@]}"; do
    mkdir -p "$dir"
done
